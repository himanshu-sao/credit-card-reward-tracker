// Renewal anchor: Aspire Free Night worked example (immediate instance on
// approval + fee_date cycles) plus the fallback chain.
// Spec AC6; doc §7 edge case 7; confirmed answer 2/assumption 5.

import { describe, expect, it } from 'vitest';
import { generateBenefitInstances } from '../generate.js';
import { seedBenefit } from '../test-benefit.js';

function freeNight(effectiveFrom = '2026-01-01') {
  return { ...seedBenefit('aspire-free-night-reward'), effective_from: effectiveFrom };
}

describe('renewal anchor', () => {
  // Spec AC6 — open 2026-06-15, fee_date 2027-05-01, asOf 2027-06-01.
  it('Aspire Free Night: immediate open_date instance, then fee_date cycle', () => {
    const result = generateBenefitInstances({
      benefit: freeNight(),
      cardDates: { open_date: '2026-06-15', fee_date: '2027-05-01' },
      asOf: '2027-06-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => [i.period_start, i.period_end])).toEqual([
      ['2026-06-15', '2027-04-30'], // fires on approval (doc §5.3)
      ['2027-05-01', '2028-04-30'], // fee-date-anchored renewal cycle
    ]);
    expect(result.instances.every((i) => i.prorated === false)).toBe(true);
    expect(result.instances[0].amount_available_cents).toBeNull(); // 1 night
  });

  // Doc §7 edge case 7 — fallback chain: no fee_date → anniversary_date.
  it('missing fee_date falls back to anniversary_date', () => {
    const result = generateBenefitInstances({
      benefit: freeNight(),
      cardDates: { open_date: '2026-06-15', anniversary_date: '2026-09-20' },
      asOf: '2027-10-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => i.period_start)).toEqual([
      '2026-06-15', // immediate approval instance
      '2026-09-20', // anniversary-anchored cycle
      '2027-09-20',
    ]);
  });

  // Doc §7 edge case 7 — missing both: anchor cycles on open_date.
  it('missing fee_date and anniversary_date falls back to open_date', () => {
    const result = generateBenefitInstances({
      benefit: freeNight(),
      cardDates: { open_date: '2026-06-15' },
      asOf: '2027-06-15',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => i.period_start)).toEqual(['2026-06-15', '2027-06-15']);
  });

  // Doc §7 edge case 4 — as_of before the first fee cycle keeps only the
  // immediate instance.
  it('as_of inside the first year yields only the immediate instance', () => {
    const result = generateBenefitInstances({
      benefit: freeNight(),
      cardDates: { open_date: '2026-06-15', fee_date: '2027-05-01' },
      asOf: '2026-12-31',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0].period_start).toBe('2026-06-15');
  });

  // Doc §7 edge case 4 — as_of exactly on the fee_date starts the cycle.
  it('as_of on the fee_date starts the renewal cycle period', () => {
    const result = generateBenefitInstances({
      benefit: freeNight(),
      cardDates: { open_date: '2026-06-15', fee_date: '2027-05-01' },
      asOf: '2027-05-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances).toHaveLength(2);
    expect(result.instances[1].period_start).toBe('2027-05-01');
  });
});
