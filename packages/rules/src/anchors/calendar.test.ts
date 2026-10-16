// Calendar-grid anchors: month, quarter, half_year, calendar_year.
// Test matrix per spec acceptance criteria 2, 3, 9, 11, 12 and doc §7
// edge cases 2 (mid-year opening), 4 (boundaries), 9 (half/quarter starts),
// 1 (calendar vs anniversary divergence).

import { describe, expect, it } from 'vitest';
import { generateBenefitInstances } from '../generate.js';
import { seedBenefit } from '../test-benefit.js';

/** Seed benefits whose effective_from would gate the scenario; widen it. */
function from2026(id: string) {
  return { ...seedBenefit(id), effective_from: '2026-01-01' };
}

describe('calendar anchors', () => {
  // Doc §7 edge case 2 / spec AC2 — mid-year opening flags, never scales.
  it('month: mid-month open keeps full amount with prorated flag', () => {
    const result = generateBenefitInstances({
      benefit: from2026('amex-platinum-digital-entertainment-credit'),
      cardDates: { open_date: '2026-03-10' },
      asOf: '2026-03-31',
    });
    expect(result).toEqual({
      kind: 'periods',
      instances: [
        {
          benefit_id: 'amex-platinum-digital-entertainment-credit',
          period_start: '2026-03-01',
          period_end: '2026-03-31',
          amount_available_cents: 30000,
          prorated: true,
          status: 'active',
        },
      ],
    });
  });

  // Doc §7 edge case 9 / spec AC3 — Jul 1 boundary starts the Jul–Dec period.
  it('half_year: as_of on Jul 1 makes the Jul–Dec period current', () => {
    const result = generateBenefitInstances({
      benefit: from2026('bilt-hotel-credit'),
      cardDates: { open_date: '2026-01-01' },
      asOf: '2026-07-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances).toEqual([
      {
        benefit_id: 'bilt-hotel-credit',
        period_start: '2026-01-01',
        period_end: '2026-06-30',
        amount_available_cents: 20000,
        prorated: false,
        status: 'active',
      },
      {
        benefit_id: 'bilt-hotel-credit',
        period_start: '2026-07-01',
        period_end: '2026-12-31',
        amount_available_cents: 20000,
        prorated: false,
        status: 'active',
      },
    ]);
  });

  // Doc §7 edge case 9 — same convention at Jan 1 (spec AC3).
  it('half_year: as_of on Jan 1 starts the Jan–Jun period', () => {
    const result = generateBenefitInstances({
      benefit: from2026('bilt-hotel-credit'),
      cardDates: { open_date: '2026-01-01' },
      asOf: '2027-01-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    const last = result.instances[result.instances.length - 1];
    expect(last.period_start).toBe('2027-01-01');
  });

  // Doc §7 edge case 9 — quarter boundary: as_of on Apr 1 starts Q2.
  it('quarter: as_of on each quarter boundary starts the new quarter', () => {
    const benefit = from2026('amex-platinum-resy-dining-credit');
    const starts = ['2026-04-01', '2026-07-01', '2026-10-01', '2027-01-01'];
    for (const asOf of starts) {
      const result = generateBenefitInstances({
        benefit,
        cardDates: { open_date: '2026-01-01' },
        asOf,
      });
      expect(result.kind).toBe('periods');
      if (result.kind !== 'periods') return;
      const last = result.instances[result.instances.length - 1];
      expect(last.period_start).toBe(asOf);
      expect(last.prorated).toBe(false);
    }
  });

  // Doc §7 edge case 4 / spec AC11 — as_of == period_end keeps the period.
  it('month: as_of on period_end keeps that period current', () => {
    const result = generateBenefitInstances({
      benefit: from2026('amex-platinum-digital-entertainment-credit'),
      cardDates: { open_date: '2026-01-05' },
      asOf: '2026-02-28',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    const last = result.instances[result.instances.length - 1];
    expect(last.period_start).toBe('2026-02-01');
    expect(last.period_end).toBe('2026-02-28');
  });

  // Doc §7 edge case 1 / spec AC12 — as_of 2027-01-01: the calendar-year
  // anchor starts a new period exactly on Jan 1 (anniversary anchors would
  // not — asserted in anniversary.test.ts).
  it('calendar_year: Jan 1 of a later year starts a new period', () => {
    const benefit = from2026('amex-platinum-clear-plus');
    const result = generateBenefitInstances({
      benefit,
      cardDates: { open_date: '2026-06-01' },
      asOf: '2027-01-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => i.period_start)).toEqual(['2026-01-01', '2027-01-01']);
    // Mid-year open: first period is grid-aligned (Jan 1), flagged prorated
    // with the full amount (doc §7 edge case 2).
    expect(result.instances[0].prorated).toBe(true);
    expect(result.instances[1].prorated).toBe(false);
  });

  // Doc §7 edge case 2 — full history from open to as_of, bounds unchanged.
  it('calendar_year: full-year history is generated with grid-aligned bounds', () => {
    const result = generateBenefitInstances({
      benefit: from2026('amex-platinum-clear-plus'),
      cardDates: { open_date: '2026-06-01' },
      asOf: '2028-06-01',
    });
    expect(result.kind).toBe('periods');
    if (result.kind !== 'periods') return;
    expect(result.instances.map((i) => [i.period_start, i.period_end])).toEqual([
      ['2026-01-01', '2026-12-31'], // mid-year open: prorated, full amount
      ['2027-01-01', '2027-12-31'],
      ['2028-01-01', '2028-12-31'],
    ]);
    expect(result.instances[0].amount_available_cents).toBe(20900);
  });
});
