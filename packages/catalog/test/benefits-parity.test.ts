import { describe, expect, it } from 'vitest';
import { activeBenefits, allBenefits, cards } from '../src/index.js';

const byId = (id: string) => {
  const row = allBenefits.find((b) => b.id === id);
  if (!row) throw new Error(`missing benefit ${id}`);
  return row;
};

describe('benefit parity (doc §5.1–5.6)', () => {
  it('per-card row counts match the manifest (Amex Platinum: 16 rows, see build.md)', () => {
    const counts = cards
      .map((card) => ({
        id: card.id,
        n: allBenefits.filter((b) => b.card_id === card.id).length,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(counts).toEqual([
      { id: 'amex-platinum', n: 16 },
      { id: 'bilt-palladium', n: 7 },
      { id: 'chase-sapphire-preferred', n: 6 },
      { id: 'hilton-amex-aspire', n: 10 },
      { id: 'hilton-amex-surpass', n: 6 },
      { id: 'marriott-bonvoy-brilliant', n: 9 },
    ]);
  });

  it('every card_id resolves and benefit ids are unique', () => {
    const cardIds = new Set(cards.map((c) => c.id));
    for (const b of allBenefits) expect(cardIds.has(b.card_id)).toBe(true);
    expect(new Set(allBenefits.map((b) => b.id)).size).toBe(allBenefits.length);
  });

  it('spot-check: CSP hotel credit', () => {
    const row = byId('csp-hotel-credit');
    expect(row.amount_cents).toBe(10000);
    expect(row.reset_anchor).toEqual({ type: 'anniversary' });
    expect(row.verification).toBe('confirmed');
    expect(row.effective_from).toBe('2026-06-15');
  });

  it('spot-check: Aspire resort credit', () => {
    const row = byId('aspire-resort-credit');
    expect(row.amount_cents).toBe(20000);
    expect(row.reset_anchor).toEqual({ type: 'half_year' });
  });

  it('spot-check: Brilliant dining credit', () => {
    const row = byId('brilliant-dining-credit');
    expect(row.amount_cents).toBe(2500);
    expect(row.reset_anchor).toEqual({ type: 'month' });
  });

  it('spot-check: Surpass threshold row', () => {
    const row = byId('surpass-free-night-reward');
    expect(row.reset_anchor).toEqual({ type: 'spend_threshold', threshold_cents: 1500000 });
  });

  it('spot-check: CLEAR+ rows carry 20900 with the source range in the note', () => {
    for (const id of ['amex-platinum-clear-plus', 'aspire-clear-plus']) {
      const row = byId(id);
      expect(row.amount_cents).toBe(20900);
      expect(row.note).toMatch(/\$189–\$219/);
    }
  });

  it('threshold and multi_year fields (criterion 8)', () => {
    expect(byId('aspire-free-night-30k').reset_anchor).toEqual({
      type: 'spend_threshold',
      threshold_cents: 3000000,
    });
    expect(byId('aspire-free-night-60k').reset_anchor).toEqual({
      type: 'spend_threshold',
      threshold_cents: 6000000,
    });
    expect(byId('surpass-temporary-diamond').reset_anchor).toEqual({
      type: 'spend_threshold',
      threshold_cents: 4000000,
    });
    expect(byId('brilliant-earned-choice-award').reset_anchor).toEqual({
      type: 'spend_threshold',
      threshold_cents: 6000000,
    });
    for (const id of ['csp-global-entry', 'brilliant-global-entry']) {
      expect(byId(id).reset_anchor).toEqual({ type: 'multi_year', interval_years: 4 });
    }
  });

  it('retired Saks stays in allBenefits but is excluded from activeBenefits', () => {
    const saks = byId('amex-platinum-saks-credit');
    expect(saks.status).toBe('retired');
    expect(saks.effective_to).toBe('2026-07-31');
    expect(activeBenefits.some((b) => b.id === 'amex-platinum-saks-credit')).toBe(false);
  });

  it('Amex hotel credit is two 30000 tranches (money spot-total, edge case 5)', () => {
    const row = byId('amex-platinum-hotel-credit');
    expect(row.amount_cents).toBe(30000);
    expect(2 * row.amount_cents).toBe(60000);
  });
});
