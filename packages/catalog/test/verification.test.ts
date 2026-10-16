import { describe, expect, it } from 'vitest';
import { allBenefits } from '../src/index.js';

const verifyRows = () => allBenefits.filter((b) => b.verification === 'verify');
const byId = (id: string) => {
  const row = allBenefits.find((b) => b.id === id);
  if (!row) throw new Error(`missing benefit ${id}`);
  return row;
};

describe('verification flags (criterion 4)', () => {
  it('has exactly 22 verify rows (3/10/3/2/1/3 per card)', () => {
    expect(verifyRows()).toHaveLength(22);
    const perCard: Record<string, number> = {};
    for (const row of verifyRows()) perCard[row.card_id] = (perCard[row.card_id] ?? 0) + 1;
    expect(perCard).toEqual({
      'chase-sapphire-preferred': 3,
      'amex-platinum': 10,
      'hilton-amex-aspire': 3,
      'hilton-amex-surpass': 2,
      'bilt-palladium': 1,
      'marriott-bonvoy-brilliant': 3,
    });
  });

  it('every verify row carries a note; confirmed rows never do by requirement', () => {
    for (const row of verifyRows()) {
      expect(row.note).toBeTruthy();
    }
  });

  it("flags the doc's Verify rows", () => {
    for (const id of [
      'csp-global-entry',
      'csp-earning',
      'csp-other-perks',
      'amex-platinum-hotel-credit',
      'amex-platinum-resy-dining-credit',
      'amex-platinum-digital-entertainment-credit',
      'amex-platinum-lululemon-credit',
      'amex-platinum-equinox-credit',
      'amex-platinum-clear-plus',
      'amex-platinum-uber-cash',
      'amex-platinum-oura-credit',
      'amex-platinum-walmart-plus-credit',
      'amex-platinum-hotel-status',
      'aspire-clear-plus',
      'aspire-property-credit',
      'aspire-lounge-access',
      'surpass-temporary-diamond',
      'surpass-national-car-status',
      'bilt-cash',
      'brilliant-free-night-award',
      'brilliant-property-credit',
      'brilliant-global-entry',
    ]) {
      expect(byId(id).verification).toBe('verify');
    }
  });
});

describe('enrollment_required (edge case 8)', () => {
  it('marks the doc\'s "Enrollment required" rows', () => {
    for (const id of [
      'amex-platinum-resy-dining-credit',
      'amex-platinum-digital-entertainment-credit',
      'amex-platinum-lululemon-credit',
      'amex-platinum-equinox-credit',
      'amex-platinum-uber-cash',
      'amex-platinum-oura-credit',
      'amex-platinum-walmart-plus-credit',
      'amex-platinum-hotel-status',
      'aspire-national-car-status',
      'aspire-lounge-access',
      'surpass-national-car-status',
      'bilt-priority-pass',
      'brilliant-priority-pass',
    ]) {
      expect(byId(id).enrollment_required).toBe(true);
    }
  });
});
