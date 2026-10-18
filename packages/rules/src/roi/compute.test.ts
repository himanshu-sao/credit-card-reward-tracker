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
