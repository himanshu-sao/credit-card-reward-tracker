// Overlap rules (doc §3.9) and their registry. A static rule fires iff ≥ 2 of
// its catalog cards are held (`all` mode: every card held — used by the
// directional Diamond rule); unknown wallet ids are ignored (the t1 schema
// passes them by design — this registry owns firing). `detectOverlaps` is the
// composed entry point: all static rules plus the time-aware Global Entry rule.

import { z } from 'zod';
import { addYears, compareISO } from '../dates.js';
import { OverlapInputSchema, type OverlapInput } from './input.js';

export const OverlapWarningSchema = z.object({
  rule_id: z.string().min(1),
  message: z.string().min(1),
  benefit_ids: z.array(z.string().min(1)).min(1),
});

export type OverlapWarning = z.infer<typeof OverlapWarningSchema>;

interface StaticRule {
  rule_id: string;
  message: string;
  cards: { card_id: string; benefit_id: string }[];
  // Absent: fires iff ≥ 2 of `cards` are held. `all`: iff every one is held.
  firing?: 'all';
}

const STATIC_RULES: StaticRule[] = [
  {
    rule_id: 'clear-plus-reimbursement',
    message:
      'Two cards offer CLEAR+ reimbursement — only one CLEAR+ membership needs reimbursement.',
    cards: [
      { card_id: 'amex-platinum', benefit_id: 'amex-platinum-clear-plus' },
      { card_id: 'hilton-amex-aspire', benefit_id: 'aspire-clear-plus' },
    ],
  },
  {
    rule_id: 'airline-credit-rules-differ',
    message:
      'Airline credits differ in eligibility (one airline per year vs quarterly flight credits) — they do not duplicate.',
    cards: [
      { card_id: 'amex-platinum', benefit_id: 'amex-platinum-airline-incidental-credit' },
      { card_id: 'hilton-amex-aspire', benefit_id: 'aspire-flight-credit' },
    ],
  },
  {
    rule_id: 'hotel-credit-no-stack',
    message: 'Multiple hotel portal credits held — one booking cannot use two portal credits.',
    cards: [
      { card_id: 'chase-sapphire-preferred', benefit_id: 'csp-hotel-credit' },
      { card_id: 'amex-platinum', benefit_id: 'amex-platinum-hotel-credit' },
      { card_id: 'bilt-palladium', benefit_id: 'bilt-hotel-credit' },
    ],
  },
  {
    rule_id: 'priority-pass-best-path',
    message:
      'Multiple Priority Pass memberships held — pick one card for lounge access; the others duplicate it.',
    cards: [
      { card_id: 'hilton-amex-aspire', benefit_id: 'aspire-lounge-access' },
      { card_id: 'bilt-palladium', benefit_id: 'bilt-priority-pass' },
      { card_id: 'marriott-bonvoy-brilliant', benefit_id: 'brilliant-priority-pass' },
    ],
  },
  {
    rule_id: 'hilton-diamond-redundant',
    message: "Aspire's Hilton Diamond status makes Surpass's automatic Gold status redundant.",
    firing: 'all',
    cards: [
      { card_id: 'hilton-amex-aspire', benefit_id: 'aspire-diamond-status' },
      { card_id: 'hilton-amex-surpass', benefit_id: 'surpass-gold-status' },
    ],
  },
];

export function detectStaticOverlaps(input: OverlapInput): OverlapWarning[] {
  const { wallet } = OverlapInputSchema.parse(input);
  const held = new Set(wallet);
  return STATIC_RULES.flatMap((rule) => {
    const benefitIds = rule.cards.filter((c) => held.has(c.card_id)).map((c) => c.benefit_id);
    const threshold = rule.firing === 'all' ? rule.cards.length : 2;
    return benefitIds.length >= threshold
      ? [{ rule_id: rule.rule_id, message: rule.message, benefit_ids: benefitIds }]
      : [];
  });
}

// GE cards whose credit covers the 4-year membership window (doc §3.9;
// Amex Platinum has no GE row in the catalog).
const GE_COVERAGE: { card_id: string; benefit_id: string }[] = [
  { card_id: 'chase-sapphire-preferred', benefit_id: 'csp-global-entry' },
  { card_id: 'marriott-bonvoy-brilliant', benefit_id: 'brilliant-global-entry' },
];

/**
 * Time-aware Global Entry rule (user-confirmed Q3): warns iff a GE card is
 * held and a new application starting at `asOf` would begin before the
 * 4-year coverage from `last_ge_application_date` expires. Coverage ending
 * exactly at `asOf` is no overlap. Missing date → never fires. Malformed
 * dates never reach here (t1 `OverlapInputSchema` rejects them first).
 */
function geOverlaps(input: OverlapInput): OverlapWarning[] {
  const { wallet, asOf, last_ge_application_date } = OverlapInputSchema.parse(input);
  if (!last_ge_application_date) return [];
  const benefitIds = GE_COVERAGE.filter((c) => wallet.includes(c.card_id)).map((c) => c.benefit_id);
  if (benefitIds.length === 0) return [];
  // A future date is not a completed application — never warns (edge 1).
  const completed = compareISO(last_ge_application_date, asOf) <= 0;
  const coverageActive = compareISO(addYears(last_ge_application_date, 4), asOf) > 0;
  return completed && coverageActive
    ? [
        {
          rule_id: 'global-entry-overlap',
          message:
            'A held card already covered Global Entry — the 4-year window from the last application has not expired yet.',
          benefit_ids: benefitIds,
        },
      ]
    : [];
}

/** All overlap rules composed: t2 static rules + the time-aware GE rule. */
export function detectOverlaps(input: OverlapInput): OverlapWarning[] {
  return [...detectStaticOverlaps(input), ...geOverlaps(input)];
}
