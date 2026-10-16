// Test fixtures: seed-benefit lookup plus a synthetic-benefit builder used
// by the anchor test files (retired/changed/leap-day cases need inputs the
// seed data does not cover).

import { BenefitSchema, allBenefits, type Benefit, type ResetAnchor } from '@ccrt/catalog';

/**
 * Look up a seed benefit by id (fails loudly if the id is unknown). Tests
 * that need different effective dates override them on a spread-copy —
 * never by editing the catalog seed data.
 */
export function seedBenefit(id: string): Benefit {
  const benefit = allBenefits.find((b) => b.id === id);
  if (!benefit) throw new Error(`unknown seed benefit id: ${id}`);
  return benefit;
}

/** Base defaults for synthetic benefits. */
const SYNTHETIC_BASE = {
  card_id: 'synthetic-card',
  name: 'Synthetic benefit',
  category: 'travel',
  value_descriptor: 'Synthetic',
  enrollment_required: false,
  source_url: 'https://example.com/card',
  last_verified_at: '2026-10-15',
  verification: 'confirmed',
} as const;

/** Build a Zod-valid synthetic benefit with overrides. */
export function syntheticBenefit(
  overrides: Partial<Benefit> & { reset_anchor: ResetAnchor },
): Benefit {
  return BenefitSchema.parse({
    ...SYNTHETIC_BASE,
    id: 'synthetic-benefit',
    amount_cents: 10000,
    status: 'active',
    effective_from: '2020-01-01',
    effective_to: null,
    ...overrides,
  });
}
