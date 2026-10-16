import { describe, expect, it } from 'vitest';
import { activeBenefits, allBenefits, BenefitSchema, currencies } from '../src/index.js';
import type { Benefit } from '../src/index.js';

const valid: Benefit = {
  id: 'edge-benefit',
  card_id: 'edge-card',
  name: 'Edge benefit',
  category: 'travel',
  amount_cents: 10000,
  value_descriptor: '$100 per year',
  cadence: 'annually',
  reset_anchor: { type: 'anniversary' },
  rules: 'Rules.',
  enrollment_required: false,
  status: 'active',
  effective_from: '2026-10-01',
  effective_to: null,
  source_url: 'https://example.com/card',
  last_verified_at: '2026-10-15',
  verification: 'confirmed',
};

describe('doc §7 edge cases', () => {
  // 1. money strictness
  it('rejects negative and non-integer amounts; accepts 0 and null', () => {
    expect(BenefitSchema.safeParse({ ...valid, amount_cents: -1 }).success).toBe(false);
    expect(BenefitSchema.safeParse({ ...valid, amount_cents: 100.5 }).success).toBe(false);
    expect(BenefitSchema.safeParse({ ...valid, amount_cents: 0 }).success).toBe(true);
    expect(
      BenefitSchema.safeParse({ ...valid, amount_cents: null, value_descriptor: 'Status' }).success,
    ).toBe(true);
  });

  it('all seeded amounts are integer cents (no dollar floats)', () => {
    for (const b of allBenefits) {
      if (b.amount_cents !== null) expect(Number.isInteger(b.amount_cents)).toBe(true);
    }
  });

  // 2. effective window inversion
  it('rejects effective_from after effective_to', () => {
    expect(
      BenefitSchema.safeParse({
        ...valid,
        effective_from: '2026-10-02',
        effective_to: '2026-10-01',
      }).success,
    ).toBe(false);
  });

  it('Saks retirement window is not inverted', () => {
    const saks = allBenefits.find((b) => b.id === 'amex-platinum-saks-credit');
    expect(saks && saks.effective_from <= saks.effective_to!).toBe(true);
  });

  // 3. retired stays queryable, filtered from active
  it('retired row present in allBenefits, absent from activeBenefits', () => {
    expect(allBenefits.some((b) => b.status === 'retired')).toBe(true);
    expect(activeBenefits.some((b) => b.status === 'retired')).toBe(false);
    expect(activeBenefits.length).toBe(allBenefits.length - 1);
  });

  // 4. discriminated union requirements
  it('multi_year needs interval_years; spend_threshold needs threshold_cents', () => {
    expect(
      BenefitSchema.safeParse({
        ...valid,
        reset_anchor: { type: 'multi_year' },
      }).success,
    ).toBe(false);
    expect(
      BenefitSchema.safeParse({
        ...valid,
        reset_anchor: { type: 'spend_threshold' },
      }).success,
    ).toBe(false);
  });

  // 6. unknown currency / duplicate ids
  it('seeded currency ids are unique and resolve', () => {
    expect(new Set(currencies.map((c) => c.id)).size).toBe(currencies.length);
  });

  it('seeded benefit ids are unique', () => {
    expect(new Set(allBenefits.map((b) => b.id)).size).toBe(allBenefits.length);
  });

  // 7. verify requires note
  it('a verify row without a note fails', () => {
    expect(BenefitSchema.safeParse({ ...valid, verification: 'verify' }).success).toBe(false);
  });

  // 9. undated rows default to 2026-10-01; only CSP hotel credit and Saks carry doc dates
  it('effective_from defaults', () => {
    const dated = allBenefits.filter((b) => b.effective_from !== '2026-10-01');
    // CSP hotel credit (2026-06-15 per doc) and the retired Saks row
    // (effective 2026-01-01 → retired 2026-07-31) are the only dated rows.
    expect(dated.map((b) => b.id)).toEqual(['csp-hotel-credit', 'amex-platinum-saks-credit']);
    const closed = allBenefits.filter((b) => b.effective_to !== null);
    expect(closed.map((b) => b.id)).toEqual(['amex-platinum-saks-credit']);
    expect(closed[0].effective_to).toBe('2026-07-31');
    expect(closed[0].effective_from).toBe('2026-01-01');
  });
});
