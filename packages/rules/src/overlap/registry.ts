// Static overlap rules (doc §3.9) and their registry. A rule fires iff ≥ 2 of
// its catalog cards are held (`all` mode: every card held — used by the
// directional Diamond rule); unknown wallet ids are ignored (the t1 schema
// passes them by design — this registry owns firing). The time-aware Global
// Entry rule (t4) is not built here.

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
