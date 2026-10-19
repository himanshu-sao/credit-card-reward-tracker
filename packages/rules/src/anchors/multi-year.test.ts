// multi_year anchor: Global Entry worked example (interval_years 4),
// generic intervals, and input-schema rejection of non-positive intervals.
// Spec AC4; doc §7 edge case 8; confirmed answer 4.

import { describe, expect, it } from 'vitest';
import { ResetAnchorSchema } from '@ccrt/catalog';
import { generateBenefitInstances } from '../generate.js';
import { seedBenefit } from '../test-benefit.js';

function globalEntry(effectiveFrom = '2026-01-01') {
  return { ...seedBenefit('csp-global-entry'), effective_from: effectiveFrom };
}

describe('multi_year anchor', () => {
  // Spec AC4 — interval_years 4, one period covering four years.
  it('Global Entry: interval 4, exactly one 2026-10-01 to 2030-09-30 period', () => {
    const result = generateBenefitInstances({
      benefit: globalEntry(),
      cardDates: { open_date: '2026-10-01' },
      asOf: '2029-12-31',
    });
    expect(result).toEqual({
      kind: 'periods',
      instances: [
        {
          benefit_id: 'csp-global-entry',
          period_start: '2026-10-01',
          period_end: '2030-09-30',
          amount_available_cents: 12000,
          prorated: false,
          status: 'active',
        },
      ],
    });
  });

  // Spec AC4 — the engine trusts interval_years generically (answer 4).
  // NOTE: spec AC4 says "1 instance ending 2029-09-30", but its own confirmed
  // rule (assumption 3/11: a period is generated when period_start <= as_of)
  // also starts the 2029-10-01 period at asOf 2029-12-31 — the count in the
  // AC text is an arithmetic slip. The first instance does end 2029-09-30.
  it('interval_years 3: first period ends 2029-09-30, next starts 2029-10-01', () => {
    const result = generateBenefitInstances({
      benefit: { ...globalEntry(), reset_anchor: { type: 'multi_year', interval_years: 3 } },
      cardDates: { open_date: '2026-10-01' },
      asOf: '2029-12-31',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => [i.period_start, i.period_end])).toEqual([
      ['2026-10-01', '2029-09-30'],
      ['2029-10-01', '2032-09-30'],
    ]);
  });

  // Doc §7 edge case 8 — interval 1 degenerates to annual.
  it('interval_years 1 degenerates to annual periods', () => {
    const result = generateBenefitInstances({
      benefit: { ...globalEntry(), reset_anchor: { type: 'multi_year', interval_years: 1 } },
      cardDates: { open_date: '2026-10-01' },
      asOf: '2028-10-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => [i.period_start, i.period_end])).toEqual([
      ['2026-10-01', '2027-09-30'],
      ['2027-10-01', '2028-09-30'],
      ['2028-10-01', '2029-09-30'],
    ]);
  });

  // Doc §7 edge case 8 / spec AC4 — zero/negative intervals are rejected by
  // the catalog's ResetAnchorSchema at input parse time, not by the engine.
  it('interval_years 0 and negative are rejected by the input schema', () => {
    expect(ResetAnchorSchema.safeParse({ type: 'multi_year', interval_years: 0 }).success).toBe(
      false,
    );
    expect(ResetAnchorSchema.safeParse({ type: 'multi_year', interval_years: -1 }).success).toBe(
      false,
    );
  });

  // Doc §7 edge case 8 / spec AC9 — non-monetary multi-year benefits still
  // generate periods (amount_cents null flows through untouched).
  it('non-monetary multi_year benefit generates periods with null amount', () => {
    const result = generateBenefitInstances({
      benefit: {
        ...globalEntry(),
        amount_cents: null,
        value_descriptor: 'Fee credit, non-monetary bookkeeping',
      },
      cardDates: { open_date: '2026-10-01' },
      asOf: '2029-12-31',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0].amount_available_cents).toBeNull();
  });
});
