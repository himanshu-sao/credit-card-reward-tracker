// ROI core acceptance criteria: window math, both nets, valuation scaling,
// detail rows, and the no-scaling edges (spec 004-t5 AC1–AC5).

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
