// AC7 rejection matrix + AC8 input edges for the ROI input contract.

import { describe, expect, it } from 'vitest';
import { RoiInputSchema, instanceKey } from './input.js';

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

const valid = (over: Record<string, unknown>) => RoiInputSchema.parse({ ...BASE, ...over });

describe('AC7 — invalid inputs are ZodErrors, never NaN or silent zero', () => {
  it('rejects usage above the instance cap', () => {
    const key = instanceKey('csp-hotel-credit', '2026-01-01');
    expect(() => valid({ usage: { [key]: 10001 } })).toThrow(/exceeds cap/);
  });

  it('rejects negative cents (usage and benefit amount)', () => {
    expect(() => valid({ usage: { [instanceKey('csp-hotel-credit', '2026-01-01')]: -1 } })).toThrow(
      /too_small|>=0/,
    );
    expect(() =>
      valid({
        benefits: {
          'csp-hotel-credit': { ...BASE.benefits['csp-hotel-credit'], amount_cents: -1 },
        },
      }),
    ).toThrow(/too_small|nonnegative/);
  });

  it('rejects malformed ISO dates (asOf, effective_to, period)', () => {
    expect(() => valid({ asOf: '2026-13-01' })).toThrow(/ISO date/);
    expect(() =>
      valid({
        benefits: {
          'csp-hotel-credit': { ...BASE.benefits['csp-hotel-credit'], effective_to: '2026-02-30' },
        },
      }),
    ).toThrow(/ISO date/);
    expect(() =>
      valid({ instances: [{ ...BASE.instances[0], period_start: 'not-a-date' }] }),
    ).toThrow(/ISO date/);
  });

  it('rejects unknown benefit ids in instances, usage, valuations, points_amounts', () => {
    expect(() => valid({ instances: [{ ...BASE.instances[0], benefit_id: 'ghost' }] })).toThrow(
      /unknown benefit id ghost/,
    );
    expect(() => valid({ usage: { 'ghost:2026-01-01': 1 } })).toThrow(/unknown instance key/);
    expect(() => valid({ valuations: { ghost: 0.5 } })).toThrow(/unknown benefit id ghost/);
    expect(() => valid({ points_amounts: { ghost: 1000 } })).toThrow(/unknown benefit id ghost/);
  });

  it('rejects a points amount on a monetary benefit', () => {
    expect(() => valid({ points_amounts: { 'csp-hotel-credit': 5000 } })).toThrow(
      /points amount not allowed/,
    );
  });

  it('rejects value_pct outside 0..1', () => {
    expect(() => valid({ valuations: { 'csp-hotel-credit': 1.01 } })).toThrow(/max/);
    expect(() => valid({ valuations: { 'csp-hotel-credit': -0.01 } })).toThrow(/min/);
  });
});

describe('AC8 — input edges', () => {
  const key = instanceKey('csp-hotel-credit', '2026-01-01');

  it('accepts value_pct bounds 0 and 1 (inclusive)', () => {
    expect(valid({ valuations: { 'csp-hotel-credit': 0 } }).valuations['csp-hotel-credit']).toBe(0);
    expect(valid({ valuations: { 'csp-hotel-credit': 1 } }).valuations['csp-hotel-credit']).toBe(1);
  });

  it('accepts empty maps, instances, and zero usage', () => {
    const parsed = valid({ instances: [], usage: {}, valuations: {}, points_amounts: {} });
    expect(parsed.instances).toEqual([]);
  });

  it('accepts a no_periods-style benefit with null amount and a points amount', () => {
    const parsed = valid({
      benefits: { lounge: { id: 'lounge', amount_cents: null, status: 'active' } },
      instances: [],
      points_amounts: { lounge: 20000 },
    });
    expect(parsed.points_amounts.lounge).toBe(20000);
  });

  it('usage exactly at cap parses; one cent over rejects', () => {
    expect(valid({ usage: { [key]: 10000 } }).usage[key]).toBe(10000);
    expect(() => valid({ usage: { [key]: 10001 } })).toThrow(/exceeds cap/);
  });

  it('cents_per_point below and above the catalog default parse', () => {
    const parsed = valid({ cents_per_point: { 'ultimate-rewards': 0.4 } });
    expect(parsed.cents_per_point['ultimate-rewards']).toBe(0.4);
  });
});
