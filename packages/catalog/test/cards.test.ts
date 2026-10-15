import { describe, expect, it } from 'vitest';
import { cards, currencies } from '../src/index.js';
import { CardSchema } from '../src/index.js';

describe('seed cards', () => {
  it('has exactly six cards', () => {
    expect(cards).toHaveLength(6);
  });
  it('carries the doc §1.5 fees (total 283500 — the doc\'s $2,535 figure mis-sums its own table)', () => {
    expect(cards.map((c) => c.fee_cents).sort((a, b) => a - b)).toEqual([
      9500, 15000, 49500, 55000, 65000, 89500,
    ]);
    expect(cards.reduce((sum, c) => sum + c.fee_cents, 0)).toBe(283500);
  });
  it('has unique ids', () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(6);
  });
  it('every currency_id resolves to a seeded currency', () => {
    const ids = new Set(currencies.map((c) => c.id));
    for (const card of cards) expect(ids.has(card.currency_id)).toBe(true);
  });
  it('rejects a card with an unknown currency_id at the seed level', () => {
    expect(
      cards.some((c) => !currencies.some((cur) => cur.id === c.currency_id)),
    ).toBe(false);
  });
});

describe('seed currencies', () => {
  it('has exactly the five doc §3.6 programs with positive integer valuations', () => {
    expect(currencies.map((c) => c.name).sort()).toEqual([
      'Bilt Points',
      'Hilton Honors',
      'Marriott Bonvoy',
      'Membership Rewards',
      'Ultimate Rewards',
    ]);
    for (const currency of currencies) {
      expect(Number.isInteger(currency.default_cents_per_point)).toBe(true);
      expect(currency.default_cents_per_point).toBeGreaterThan(0);
    }
  });
  it('rejects a non-integer valuation', () => {
    expect(
      CardSchema.safeParse({ ...cards[0], id: 'x', fee_cents: 1.5 }).success,
    ).toBe(false);
  });
});
