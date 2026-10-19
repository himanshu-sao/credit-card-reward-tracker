// Static overlap rules (doc §3.9) and their registry. A rule fires iff ≥ 2 of
// its catalog cards are held; unknown wallet ids are ignored (the t1 schema
// passes them by design — this registry owns firing). The time-aware Global
// Entry rule (t4) and Priority Pass / Hilton Diamond (t3) are not built here.

import { z } from 'zod';
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
];

export function detectStaticOverlaps(input: OverlapInput): OverlapWarning[] {
  const { wallet } = OverlapInputSchema.parse(input);
  const held = new Set(wallet);
  return STATIC_RULES.flatMap((rule) => {
    const benefitIds = rule.cards.filter((c) => held.has(c.card_id)).map((c) => c.benefit_id);
    return benefitIds.length >= 2
      ? [{ rule_id: rule.rule_id, message: rule.message, benefit_ids: benefitIds }]
      : [];
  });
}
