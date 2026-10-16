// Anniversary anchor: CSP hotel credit worked example, leap-day clamping,
// re-set anniversary_date, boundary conventions, cross-anchor divergence.
// Spec AC1, AC8, AC11, AC12; doc §7 edge cases 1, 3, 4.

import { describe, expect, it } from 'vitest';
import { generateBenefitInstances } from '../generate.js';
import { seedBenefit, syntheticBenefit } from '../test-benefit.js';

function cspHotel(effectiveFrom = '2026-01-01') {
  return { ...seedBenefit('csp-hotel-credit'), effective_from: effectiveFrom };
}

describe('anniversary anchor', () => {
  // Spec AC1 — the canonical CSP hotel credit worked example.
  it('CSP hotel credit: exactly two periods, second current at as_of', () => {
    const result = generateBenefitInstances({
      benefit: cspHotel(),
      cardDates: { open_date: '2026-03-10', anniversary_date: '2026-03-10' },
      asOf: '2027-03-10',
    });
    expect(result).toEqual({
      kind: 'periods',
      instances: [
        {
          benefit_id: 'csp-hotel-credit',
          period_start: '2026-03-10',
          period_end: '2027-03-09',
          amount_available_cents: 10000,
          prorated: false,
          status: 'active',
        },
        {
          benefit_id: 'csp-hotel-credit',
          period_start: '2027-03-10',
          period_end: '2028-03-09',
          amount_available_cents: 10000,
          prorated: false,
          status: 'active',
        },
      ],
    });
  });

  // Doc §7 edge case 1 / spec AC12 — at as_of 2027-01-15 the anniversary
  // anchor does NOT start a new period (calendar anchors do).
  it('cross-year as_of stays inside the anniversary period', () => {
    const result = generateBenefitInstances({
      benefit: cspHotel(),
      cardDates: { open_date: '2026-03-10' },
      asOf: '2027-01-15',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0]).toMatchObject({
      period_start: '2026-03-10',
      period_end: '2027-03-09',
    });
  });

  // Doc §7 edge case 3 / spec AC8 — Feb 29 open rolls to Feb 28 off-leap.
  it('leap-day open 2024-02-29 clamps to Feb 28 in non-leap years', () => {
    const result = generateBenefitInstances({
      benefit: syntheticBenefit({ reset_anchor: { type: 'anniversary' } }),
      cardDates: { open_date: '2024-02-29' },
      asOf: '2026-10-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => [i.period_start, i.period_end])).toEqual([
      ['2024-02-29', '2025-02-27'],
      ['2025-02-28', '2026-02-27'],
      ['2026-02-28', '2027-02-27'],
    ]);
  });

  // Doc §7 edge case 3 — re-set anniversary differs from open month/day.
  it('re-set anniversary_date overrides open_date month/day', () => {
    const result = generateBenefitInstances({
      benefit: cspHotel(),
      cardDates: { open_date: '2026-03-10', anniversary_date: '2026-09-20' },
      asOf: '2027-01-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => [i.period_start, i.period_end])).toEqual([
      ['2026-09-20', '2027-09-19'],
    ]);
  });

  // Doc §7 edge case 4 / spec AC11 — as_of == period_start starts the new
  // period (also asserted by AC1); as_of == period_end keeps it current.
  it('as_of on period_start and period_end resolve per the safety margin', () => {
    const benefit = cspHotel();
    const atEnd = generateBenefitInstances({
      benefit,
      cardDates: { open_date: '2026-03-10' },
      asOf: '2027-03-09',
    });
    expect(atEnd.kind).toBe('periods');
    if (atEnd.kind !== 'periods') return;
    expect(atEnd.instances).toHaveLength(1);
    expect(atEnd.instances[0].period_end).toBe('2027-03-09');

    const atStart = generateBenefitInstances({
      benefit,
      cardDates: { open_date: '2026-03-10' },
      asOf: '2027-03-10',
    });
    expect(atStart.kind).toBe('periods');
    if (atStart.kind !== 'periods') return;
    expect(atStart.instances).toHaveLength(2);
    expect(atStart.instances[1].period_start).toBe('2027-03-10');
  });

  // Doc §7 edge case 4 / spec AC11 — as_of == effective_from: the period
  // straddling effective_from is kept with its anchor-aligned bounds (same
  // convention AC1 forces for the seed's effective_from); as_of ==
  // effective_to keeps the period starting on it (safety margin).
  it('effective_from and effective_to boundaries keep the straddling period', () => {
    const benefit = cspHotel('2026-04-10');
    const atFrom = generateBenefitInstances({
      benefit,
      cardDates: { open_date: '2026-03-10' },
      asOf: '2026-04-10',
    });
    expect(atFrom.kind).toBe('periods');
    if (atFrom.kind !== 'periods') return;
    expect(atFrom.instances).toHaveLength(1);
    expect(atFrom.instances[0].period_start).toBe('2026-03-10');
    expect(atFrom.instances[0].period_end).toBe('2027-03-09');

    const atTo = generateBenefitInstances({
      benefit: { ...cspHotel(), effective_to: '2027-03-10' },
      cardDates: { open_date: '2026-03-10' },
      asOf: '2027-03-10',
    });
    expect(atTo.kind).toBe('periods');
    if (atTo.kind !== 'periods') return;
    expect(atTo.instances).toHaveLength(2);
  });
});
