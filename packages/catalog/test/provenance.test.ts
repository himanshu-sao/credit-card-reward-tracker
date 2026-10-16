import { describe, expect, it } from 'vitest';
import { allBenefits, cards } from '../src/index.js';

describe('source provenance (criterion 7)', () => {
  it('every benefit has a non-empty issuer source_url', () => {
    for (const benefit of allBenefits) {
      expect(benefit.source_url).toMatch(/^https:\/\//);
    }
  });

  it('uses one issuer-official card page URL per card', () => {
    const cardUrls = new Map(cards.map((c) => [c.id, new Set<string>()]));
    for (const benefit of allBenefits) {
      cardUrls.get(benefit.card_id)?.add(benefit.source_url);
    }
    for (const [cardId, urls] of cardUrls) {
      expect(urls.size, cardId).toBe(1);
    }
  });

  it('every benefit was last verified 2026-10-15', () => {
    for (const benefit of allBenefits) {
      expect(benefit.last_verified_at).toBe('2026-10-15');
    }
  });
});
