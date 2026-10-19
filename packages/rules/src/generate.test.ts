// generateBenefitInstances dispatch: no-periods contract, retired/history,
// grandfathered/changed, future effective_from, malformed input, and the
// 600-period guard. Spec AC5, AC7, AC9, AC10; doc §7 edge cases 5, 6, 8.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateBenefitInstances } from './generate.js';
import { seedBenefit, syntheticBenefit } from './test-benefit.js';

describe('no-periods contract', () => {
  // Spec AC5 / doc §7 assumption 6 — each non-periodic anchor returns an
  // explicit reason; never a silent empty list, never an exception.
  it.each([
    ['amex-platinum-saks-credit', /resets never/],
    ['amex-platinum-lounge-access', /continuous benefit/],
    ['aspire-property-credit', /per stay/],
    ['bilt-neighborhood-benefits', /per purchase/],
    ['csp-points-boost', /per booking/],
    ['aspire-free-night-30k', /spend threshold/],
  ])('%s returns no_periods with an anchor-specific reason', (id, reason) => {
    const result = generateBenefitInstances({
      benefit: seedBenefit(id),
      cardDates: { open_date: '2026-01-01' },
      asOf: '2027-01-01',
    });
    expect(result.kind).toBe('no_periods');
    if (result.kind !== 'no_periods') return;
    expect(result.reason).toMatch(reason);
  });

  // Spec AC5 — threshold tracking consumes spend_threshold (out of scope here).
  it('spend_threshold reason documents threshold tracking', () => {
    const result = generateBenefitInstances({
      benefit: seedBenefit('aspire-free-night-30k'),
      cardDates: { open_date: '2026-01-01' },
      asOf: '2026-06-01',
    });
    expect(result).toEqual({
      kind: 'no_periods',
      reason: 'resets at a spend threshold — consumed by threshold tracking, not periods',
    });
  });
});

describe('status and effective-date gating', () => {
  // Doc §7 edge case 5 / spec AC7 — retired monthly benefit: history only.
  it('retired monthly benefit stops at effective_to, past periods preserved', () => {
    const result = generateBenefitInstances({
      benefit: syntheticBenefit({
        id: 'retired-monthly',
        reset_anchor: { type: 'month' },
        status: 'retired',
        effective_to: '2026-07-31',
      }),
      cardDates: { open_date: '2026-01-01' },
      asOf: '2027-01-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => i.period_start)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01', // starts on/before effective_to: kept
    ]);
    expect(result.instances.every((i) => i.status === 'retired')).toBe(true);
  });

  // Doc §7 edge case 5 — grandfathered and changed generate forward.
  it.each(['grandfathered', 'changed'] as const)(
    '%s status generates forward like active',
    (status) => {
      const result = generateBenefitInstances({
        benefit: syntheticBenefit({
          id: `monthly-${status}`,
          status,
          reset_anchor: { type: 'month' },
        }),
        cardDates: { open_date: '2026-01-01' },
        asOf: '2026-03-15',
      });
      expect(result.kind).toBe('periods');
      if (result.kind !== 'periods') return;
      expect(result.instances).toHaveLength(3);
      expect(result.instances[2].status).toBe(status);
    },
  );

  // Doc §7 edge case 6 / spec AC7 — future effective_from: zero instances,
  // still kind 'periods' (distinct from no_periods).
  it('effective_from after as_of yields an empty periods list', () => {
    const result = generateBenefitInstances({
      benefit: syntheticBenefit({ effective_from: '2027-01-01', reset_anchor: { type: 'month' } }),
      cardDates: { open_date: '2026-01-01' },
      asOf: '2026-06-01',
    });
    expect(result).toEqual({ kind: 'periods', instances: [] });
  });
});

describe('malformed input', () => {
  // Doc §7 edge case 8 / spec AC9 — validation failures throw before any
  // generation: no partial output.
  it('bad asOf date string throws ZodError', () => {
    expect(() =>
      generateBenefitInstances({
        benefit: seedBenefit('csp-hotel-credit'),
        cardDates: { open_date: '2026-01-01' },
        asOf: '2026-13-99',
      }),
    ).toThrow(z.ZodError);
  });

  it('missing open_date throws ZodError', () => {
    expect(() =>
      generateBenefitInstances({
        benefit: seedBenefit('csp-hotel-credit'),
        cardDates: {} as never,
        asOf: '2026-06-01',
      }),
    ).toThrow(/open_date/);
  });

  it('asOf before open_date is rejected', () => {
    expect(() =>
      generateBenefitInstances({
        benefit: seedBenefit('csp-hotel-credit'),
        cardDates: { open_date: '2026-06-01' },
        asOf: '2026-05-31',
      }),
    ).toThrow(/asOf must not be before/);
  });
});

describe('600-period guard', () => {
  // Spec AC10 — a monthly anchor over ~100 years errors explicitly instead
  // of hanging or building an unbounded array.
  it('monthly anchor over a century throws the explicit guard error', () => {
    expect(() =>
      generateBenefitInstances({
        benefit: syntheticBenefit({
          reset_anchor: { type: 'month' },
          effective_from: '1900-01-01',
        }),
        cardDates: { open_date: '1926-01-01' },
        asOf: '2026-10-16',
      }),
    ).toThrow(/600-instance guard/);
  });
});
