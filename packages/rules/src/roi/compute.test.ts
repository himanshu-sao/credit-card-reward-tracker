// ROI core acceptance criteria: window math, both nets, valuation scaling,
// detail rows, the no-scaling edges (spec 004-t5 AC1–AC5), plus points face
// value and the retired-benefit exclusion (spec 004-t6 AC1–AC4).

import { cards } from '@ccrt/catalog';
import { describe, expect, it } from 'vitest';
import { RoiInputSchema, instanceKey } from './input.js';
import { CardRoiSchema, computeCardRoi } from './compute.js';

const BASE = {
  card: { id: 'csp', annual_fee_cents: 9500, currency_id: 'ultimate-rewards' },
  benefits: {
    'csp-hotel-credit': {
      id: 'csp-hotel-credit',
      amount_cents: 10000,
      status: 'active',
      effective_to: null,
    },
  },
  instances: [
    {
      benefit_id: 'csp-hotel-credit',
      period_start: '2026-01-01',
      period_end: '2026-12-31',
      amount_available_cents: 10000,
      prorated: false,
      status: 'active',
    },
  ],
  usage: {} as Record<string, number>,
  valuations: {} as Record<string, number>,
  cents_per_point: {} as Record<string, number>,
  points_amounts: {} as Record<string, number>,
  asOf: '2026-06-01',
} as const;

const roi = (over: Record<string, unknown>) =>
  CardRoiSchema.parse(computeCardRoi(RoiInputSchema.parse({ ...BASE, ...over })));

const KEY = instanceKey('csp-hotel-credit', '2026-01-01');

describe('AC1 — CSP default: realized and potential net positions', () => {
  it('fully-unused $100 instance, default valuation, fee 9500', () => {
    const result = roi({});
    expect(result.fee_cents).toBe(9500);
    expect(result.face_value_available_cents).toBe(10000);
    expect(result.value_used_cents).toBe(0);
    expect(result.net_used_cents).toBe(-9500);
    expect(result.net_available_cents).toBe(500);
  });

  it('usage counts toward value_used; both nets stay integer cents', () => {
    const result = roi({ usage: { [KEY]: 10000 } });
    expect(result.value_used_cents).toBe(10000);
    expect(result.net_used_cents).toBe(500);
  });
});

describe('AC2 — valuation fraction scales face value (0..1 contract)', () => {
  it('value_pct 55 → 0.55 fraction', () => {
    const result = roi({ valuations: { 'csp-hotel-credit': 0.55 } });
    expect(result.face_value_available_cents).toBe(5500);
    expect(result.net_available_cents).toBe(-4000);
  });

  it('fraction 0 → zero face value; fraction 1 → full face value', () => {
    expect(roi({ valuations: { 'csp-hotel-credit': 0 } }).face_value_available_cents).toBe(0);
    expect(roi({ valuations: { 'csp-hotel-credit': 1 } }).face_value_available_cents).toBe(10000);
  });
});

describe('AC3 — per-benefit and per-instance detail rows', () => {
  it('carries period, face, and used per instance keyed by instanceKey', () => {
    const result = roi({ usage: { [KEY]: 4000 } });
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0]).toEqual({
      instance_key: KEY,
      benefit_id: 'csp-hotel-credit',
      period_start: '2026-01-01',
      period_end: '2026-12-31',
      in_window: true,
      excluded_retired: false,
      face_value_cents: 10000,
      value_used_cents: 4000,
    });
    expect(result.benefits).toEqual([
      {
        benefit_id: 'csp-hotel-credit',
        face_value_available_cents: 10000,
        value_used_cents: 4000,
        redundant: false,
      },
    ]);
  });

  it('aggregates two in-window instances into one per-benefit row', () => {
    const prior = instanceKey('csp-hotel-credit', '2025-01-01');
    const result = roi({
      instances: [
        { ...BASE.instances[0], period_start: '2025-01-01', period_end: '2025-12-31' },
        BASE.instances[0],
      ],
      usage: { [prior]: 3000 },
    });
    expect(result.benefits).toEqual([
      {
        benefit_id: 'csp-hotel-credit',
        face_value_available_cents: 20000,
        value_used_cents: 3000,
        redundant: false,
      },
    ]);
    expect(result.instances).toHaveLength(2);
    expect(result.face_value_available_cents).toBe(20000);
    expect(result.net_available_cents).toBe(10500);
  });
});

describe('AC4 — window edges: no scaling of straddling or prorated instances', () => {
  it('instance straddling the window start counts at full value', () => {
    const result = roi({
      instances: [{ ...BASE.instances[0], period_start: '2025-05-15', period_end: '2025-06-15' }],
    });
    expect(result.window_start).toBe('2025-06-01');
    expect(result.instances[0].in_window).toBe(true); // period_end >= window_start
    expect(result.face_value_available_cents).toBe(10000);
  });

  it('mid-year-opened prorated: true instance counts at full value', () => {
    const result = roi({
      instances: [{ ...BASE.instances[0], period_start: '2026-04-10', prorated: true }],
    });
    expect(result.instances[0].in_window).toBe(true);
    expect(result.face_value_available_cents).toBe(10000);
  });

  it('instance entirely before the window is excluded (in_window false)', () => {
    const result = roi({
      instances: [{ ...BASE.instances[0], period_start: '2024-01-01', period_end: '2024-12-31' }],
    });
    expect(result.instances[0].in_window).toBe(false);
    expect(result.face_value_available_cents).toBe(0);
  });
});

describe('AC5 — empty input, helpers-only arithmetic, contract intact', () => {
  it('no instances/usage: both nets are -fee, detail arrays empty', () => {
    const result = roi({ instances: [] });
    expect(result.fee_cents).toBe(9500);
    expect(result.net_used_cents).toBe(-9500);
    expect(result.net_available_cents).toBe(-9500);
    expect(result.benefits).toEqual([]);
    expect(result.instances).toEqual([]);
  });

  it('window is [asOf - 12 months, asOf] via addMonths', () => {
    const result = roi({ asOf: '2026-06-01' });
    expect(result.window_start).toBe('2025-06-01');
    expect(result.window_end).toBe('2026-06-01');
  });
});

// --- 004-t6: points face value + retired exclusion ---

const POINTS_BASE = {
  ...BASE,
  card: { id: 'hilton-amex-aspire', annual_fee_cents: 55000, currency_id: 'hilton-honors' },
  benefits: {
    'aspire-free-night-reward': {
      id: 'aspire-free-night-reward',
      amount_cents: null,
      status: 'active',
      effective_to: null,
    },
  },
  instances: [
    {
      benefit_id: 'aspire-free-night-reward',
      period_start: '2026-02-01',
      period_end: '2027-01-31',
      amount_available_cents: null,
      prorated: false,
      status: 'active',
    },
  ],
} as const;

describe('AC1 — points face value: override vs catalog default, both directions', () => {
  it('85000 points × override 0.6 → 51000 cents face (net reflects it)', () => {
    const result = roi({
      ...POINTS_BASE,
      points_amounts: { 'aspire-free-night-reward': 85000 },
      cents_per_point: { 'hilton-honors': 0.6 },
    });
    expect(result.face_value_available_cents).toBe(51000);
    expect(result.net_available_cents).toBe(51000 - 55000);
    expect(result.benefits[0]).toEqual({
      benefit_id: 'aspire-free-night-reward',
      face_value_available_cents: 51000,
      value_used_cents: 0,
      redundant: false,
    });
  });

  it('no override → catalog default 1 → 85000 cents', () => {
    const result = roi({
      ...POINTS_BASE,
      points_amounts: { 'aspire-free-night-reward': 85000 },
    });
    expect(result.face_value_available_cents).toBe(85000);
  });

  it('override above the default (1.5) also honored', () => {
    const result = roi({
      ...POINTS_BASE,
      points_amounts: { 'aspire-free-night-reward': 85000 },
      cents_per_point: { 'hilton-honors': 1.5 },
    });
    expect(result.face_value_available_cents).toBe(127500);
  });

  it('no points entry → zero face value (t5 behavior unchanged); used stays 0', () => {
    const result = roi({ ...POINTS_BASE });
    expect(result.face_value_available_cents).toBe(0);
    expect(result.value_used_cents).toBe(0);
    expect(result.net_available_cents).toBe(-55000);
  });
});

describe('AC2 — no_periods benefits: zero without points, points face with an entry', () => {
  const ongoingInstance = {
    benefit_id: 'amex-platinum-flights-earning',
    period_start: '2026-01-01',
    period_end: '2026-12-31',
    amount_available_cents: null,
    prorated: false,
    status: 'active',
  };
  const ongoingBenefit = {
    id: 'amex-platinum-flights-earning',
    amount_cents: null,
    status: 'active',
    effective_to: null,
  };
  const ongoingBase = {
    ...BASE,
    card: { id: 'amex-platinum', annual_fee_cents: 89500, currency_id: 'membership-rewards' },
    benefits: { 'amex-platinum-flights-earning': ongoingBenefit },
    instances: [ongoingInstance],
  } as const;

  it('no points entry → zero face value, no crash', () => {
    const result = roi({ ...ongoingBase });
    expect(result.face_value_available_cents).toBe(0);
    expect(result.net_available_cents).toBe(-89500);
    expect(result.instances[0].in_window).toBe(true);
  });

  it('points entry → points face value (20000 × default 1)', () => {
    const result = roi({
      ...ongoingBase,
      points_amounts: { 'amex-platinum-flights-earning': 20000 },
    });
    expect(result.face_value_available_cents).toBe(20000);
    expect(result.net_available_cents).toBe(-69500);
  });

  it('points entry on a monetary benefit still rejects at RoiInputSchema.parse', () => {
    expect(() =>
      RoiInputSchema.parse({ ...BASE, points_amounts: { 'csp-hotel-credit': 5000 } }),
    ).toThrow(/points amount not allowed/);
  });
});

describe('AC3 — retired exclusion (Saks effective_to 2026-07-31), both directions', () => {
  const SAKS = {
    id: 'amex-platinum-saks-credit',
    amount_cents: 10000,
    status: 'retired' as const,
    effective_to: '2026-07-31',
  };
  const saksInstance = (period_start: string, period_end: string) => ({
    benefit_id: 'amex-platinum-saks-credit',
    period_start,
    period_end,
    amount_available_cents: 10000,
    prorated: false,
    status: 'retired' as const,
  });
  const saksBase = {
    ...BASE,
    card: { id: 'amex-platinum', annual_fee_cents: 89500, currency_id: 'membership-rewards' },
    benefits: { 'amex-platinum-saks-credit': SAKS },
    asOf: '2027-01-01',
  } as const;

  it('instance with period_end <= effective_to counts at full value', () => {
    const result = roi({ ...saksBase, instances: [saksInstance('2026-01-01', '2026-07-31')] });
    expect(result.face_value_available_cents).toBe(10000);
    expect(result.instances[0].excluded_retired).toBe(false);
  });

  it('instance with period_start > effective_to contributes zero, flagged in detail', () => {
    const result = roi({ ...saksBase, instances: [saksInstance('2026-08-01', '2027-07-31')] });
    expect(result.face_value_available_cents).toBe(0);
    expect(result.instances[0].in_window).toBe(true);
    expect(result.instances[0].excluded_retired).toBe(true);
    expect(result.instances[0].face_value_cents).toBe(0);
    expect(result.benefits).toEqual([]);
  });

  it('boundary period_start === effective_to counts', () => {
    const result = roi({ ...saksBase, instances: [saksInstance('2026-07-31', '2027-07-30')] });
    expect(result.face_value_available_cents).toBe(10000);
    expect(result.instances[0].excluded_retired).toBe(false);
  });

  it('all instances beyond effective_to → zero contribution (edge 7)', () => {
    const result = roi({
      ...saksBase,
      instances: [
        saksInstance('2026-08-01', '2027-07-31'),
        saksInstance('2027-08-01', '2028-07-31'),
      ],
      asOf: '2027-09-01',
    });
    expect(result.face_value_available_cents).toBe(0);
    expect(result.instances.filter((i) => i.excluded_retired)).toHaveLength(2);
    expect(result.benefits).toEqual([]);
  });
});

describe('AC4 — portfolio fee total across all six catalog cards = 283500', () => {
  it('sums annual_fee_cents from the ROI output per card', () => {
    const total = cards.reduce(
      (sum, card) =>
        sum +
        CardRoiSchema.parse(
          computeCardRoi(
            RoiInputSchema.parse({
              ...BASE,
              card: {
                id: card.id,
                annual_fee_cents: card.fee_cents,
                currency_id: card.currency_id,
              },
              benefits: {},
              instances: [],
            }),
          ),
        ).fee_cents,
      0,
    );
    expect(total).toBe(283500);
  });
});

// --- 004-t6 round 1: security — prototype-chain lookup regression ---

/**
 * Build a record with a genuinely own (not inherited) `__proto__` key —
 * `Object.defineProperty` shadows the prototype accessor, while a literal
 * `{ __proto__: ... }` would set the prototype instead.
 */
function recordWithOwnProtoKey(value: number): Record<string, number> {
  const rec: Record<string, number> = {};
  Object.defineProperty(rec, '__proto__', { value, enumerable: true, writable: true });
  return rec;
}

describe('round-1 security — prototype-chain keys fall back, never NaN', () => {
  it('currency_id "__proto__" with no matching override → catalog fallback missing → 0, not NaN', () => {
    const result = roi({
      ...POINTS_BASE,
      card: { id: 'x', annual_fee_cents: 0, currency_id: '__proto__' },
      points_amounts: { 'aspire-free-night-reward': 85000 },
      cents_per_point: {},
    });
    // No override and no catalog row for "__proto__" → defaultCents 0,
    // never Object.prototype (which would make this NaN).
    expect(result.face_value_available_cents).toBe(0);
    expect(result.net_available_cents).toBe(0); // 0 face − 0 fee
  });

  it('currency_id "constructor" behaves the same — fallback, not Function → NaN', () => {
    const result = roi({
      ...POINTS_BASE,
      card: { id: 'x', annual_fee_cents: 0, currency_id: 'constructor' },
      points_amounts: { 'aspire-free-night-reward': 85000 },
      cents_per_point: {},
    });
    expect(result.face_value_available_cents).toBe(0);
  });

  it('an own inherited-name override that survives parse is still honored (constructor: 0.5)', () => {
    const result = roi({
      ...POINTS_BASE,
      card: { id: 'x', annual_fee_cents: 0, currency_id: 'constructor' },
      points_amounts: { 'aspire-free-night-reward': 1000 },
      cents_per_point: { constructor: 0.5 },
    });
    expect(result.face_value_available_cents).toBe(500);
  });

  it('an own __proto__ override cannot survive RoiInputSchema.parse (setter drops it) → fallback 0', () => {
    const parsed = RoiInputSchema.parse({
      ...POINTS_BASE,
      card: { id: 'x', annual_fee_cents: 0, currency_id: '__proto__' },
      points_amounts: { 'aspire-free-night-reward': 1000 },
      cents_per_point: recordWithOwnProtoKey(0.5),
    });
    expect(Object.hasOwn(parsed.cents_per_point, '__proto__')).toBe(false);
    const result = CardRoiSchema.parse(computeCardRoi(parsed));
    expect(result.face_value_available_cents).toBe(0);
  });

  it('valuations "__proto__" with no own entry → fraction 1, not Object.prototype → NaN', () => {
    const result = roi({ valuations: { ['__proto__' as string]: 0.55 } as Record<string, number> });
    // A literal computed __proto__ key lands on the prototype (setter), so the
    // record has no own entry: fraction must fall back to 1 → full face value.
    expect(result.face_value_available_cents).toBe(10000);
  });

  it('benefit_id "constructor" in points_amounts → no own entry → zero face, not NaN', () => {
    const result = roi({
      ...POINTS_BASE,
      benefits: {
        constructor: {
          id: 'constructor',
          amount_cents: null,
          status: 'active',
          effective_to: null,
        },
      },
      instances: [
        {
          benefit_id: 'constructor',
          period_start: '2026-02-01',
          period_end: '2027-01-31',
          amount_available_cents: null,
          prorated: false,
          status: 'active',
        },
      ],
      points_amounts: {},
    });
    expect(result.face_value_available_cents).toBe(0); // toBe fails on NaN by itself
  });
});

// t7: overlap warnings annotate the breakdown (spec 004-t7 AC1–AC4). Diamond
// case: a no_periods status benefit generates no instances, so its flagged row
// is emitted zero-valued; warnings are data in and change no math.
const SURPASS = {
  card: { id: 'hilton-amex-surpass', annual_fee_cents: 15000, currency_id: 'hilton-points' },
  benefits: {
    'surpass-gold-status': {
      id: 'surpass-gold-status',
      amount_cents: null,
      status: 'active',
      effective_to: null,
    },
    'surpass-hotel-credit': {
      id: 'surpass-hotel-credit',
      amount_cents: 10000,
      status: 'active',
      effective_to: null,
    },
  },
  instances: [
    {
      benefit_id: 'surpass-hotel-credit',
      period_start: '2026-01-01',
      period_end: '2026-12-31',
      amount_available_cents: 10000,
      prorated: false,
      status: 'active',
    },
  ],
  usage: {} as Record<string, number>,
  valuations: {} as Record<string, number>,
  cents_per_point: {} as Record<string, number>,
  points_amounts: {} as Record<string, number>,
  asOf: '2026-06-01',
} as const;

const DIAMOND_WARNING = {
  rule_id: 'hilton-diamond-redundant',
  message: "Aspire's Hilton Diamond status makes Surpass's automatic Gold status redundant.",
  benefit_ids: ['aspire-diamond-status', 'surpass-gold-status'],
};

const surpassRoi = (overlap_warnings: unknown) =>
  CardRoiSchema.parse(computeCardRoi(RoiInputSchema.parse({ ...SURPASS, overlap_warnings })));

describe('AC1 — Diamond warning flags the no-instances status benefit row', () => {
  it('surpass-gold-status emits a zero-valued redundant row; others false', () => {
    const result = surpassRoi([DIAMOND_WARNING]);
    const flagged = result.benefits.filter((b) => b.redundant);
    expect(flagged).toEqual([
      {
        benefit_id: 'surpass-gold-status',
        face_value_available_cents: 0,
        value_used_cents: 0,
        redundant: true,
      },
    ]);
    expect(result.benefits.find((b) => b.benefit_id === 'surpass-hotel-credit')).toEqual({
      benefit_id: 'surpass-hotel-credit',
      face_value_available_cents: 10000,
      value_used_cents: 0,
      redundant: false,
    });
  });
});

describe('AC2 — annotation only: totals identical with and without warnings', () => {
  it('field absent and [] parse; all four card totals byte-identical', () => {
    const absent = CardRoiSchema.parse(computeCardRoi(RoiInputSchema.parse({ ...SURPASS })));
    const empty = surpassRoi([]);
    const warned = surpassRoi([DIAMOND_WARNING]);
    for (const key of [
      'face_value_available_cents',
      'value_used_cents',
      'net_used_cents',
      'net_available_cents',
    ] as const) {
      expect(warned[key]).toBe(absent[key]);
      expect(empty[key]).toBe(absent[key]);
    }
    expect(absent.benefits.every((b) => !b.redundant)).toBe(true);
  });
});

describe('AC3 — warning ids unknown to the card are ignored', () => {
  it('Diamond warning on a card lacking surpass-gold-status: no crash, no extra row', () => {
    // Surpass input minus the status benefit, as when computing Aspire's ROI.
    const withoutStatus = {
      ...SURPASS,
      benefits: { 'surpass-hotel-credit': SURPASS.benefits['surpass-hotel-credit'] },
    };
    const roiOf = (over: Record<string, unknown>) =>
      CardRoiSchema.parse(computeCardRoi(RoiInputSchema.parse({ ...withoutStatus, ...over })));
    const baseline = roiOf({});
    expect(roiOf({ overlap_warnings: [DIAMOND_WARNING] }).benefits).toEqual(baseline.benefits);
    expect(baseline.benefits).toHaveLength(1);
  });
});

describe('AC4 — duplicate flags on one benefit collapse to a single row', () => {
  it('two warnings naming surpass-gold-status → one flagged row', () => {
    const result = surpassRoi([
      DIAMOND_WARNING,
      { ...DIAMOND_WARNING, rule_id: 'another-rule', benefit_ids: ['surpass-gold-status'] },
    ]);
    const flagged = result.benefits.filter((b) => b.benefit_id === 'surpass-gold-status');
    expect(flagged).toEqual([
      {
        benefit_id: 'surpass-gold-status',
        face_value_available_cents: 0,
        value_used_cents: 0,
        redundant: true,
      },
    ]);
    expect(result.benefits).toHaveLength(2);
  });
});
