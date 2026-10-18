// Static overlap rules (doc §3.9) + registry firing semantics, asserted
// against the t1 input contract (unknown ids pass; duplicates reject there).

import { describe, expect, it } from 'vitest';
import { OverlapInputSchema } from './input.js';
import { detectStaticOverlaps, OverlapWarningSchema } from './registry.js';

const BASE = {
  wallet: ['csp', 'amex-brilliant'],
  asOf: '2026-06-01',
  last_ge_application_date: '2025-11-15',
} as const;

const valid = (over: Record<string, unknown>) => OverlapInputSchema.parse({ ...BASE, ...over });

const ruleIds = (wallet: string[]) =>
  detectStaticOverlaps(valid({ wallet, last_ge_application_date: undefined })).map(
    (w) => w.rule_id,
  );

describe('detectStaticOverlaps — the three static rules', () => {
  it('CLEAR+ rule fires for [amex-platinum, hilton-amex-aspire] with seeded benefit ids', () => {
    const warnings = detectStaticOverlaps(
      valid({
        wallet: ['amex-platinum', 'hilton-amex-aspire'],
        last_ge_application_date: undefined,
      }),
    );
    expect(warnings).toEqual([
      {
        rule_id: 'clear-plus-reimbursement',
        message:
          'Two cards offer CLEAR+ reimbursement — only one CLEAR+ membership needs reimbursement.',
        benefit_ids: ['amex-platinum-clear-plus', 'aspire-clear-plus'],
      },
      {
        rule_id: 'airline-credit-rules-differ',
        message:
          'Airline credits differ in eligibility (one airline per year vs quarterly flight credits) — they do not duplicate.',
        benefit_ids: ['amex-platinum-airline-incidental-credit', 'aspire-flight-credit'],
      },
    ]);
  });

  it('dropping either CLEAR+ card kills the CLEAR+ warning', () => {
    expect(ruleIds(['amex-platinum'])).not.toContain('clear-plus-reimbursement');
    expect(ruleIds(['hilton-amex-aspire'])).not.toContain('clear-plus-reimbursement');
  });

  it('airline rule needs both cards — Aspire alone yields no warning', () => {
    expect(ruleIds(['hilton-amex-aspire'])).toEqual([]);
  });

  it('hotel rule fires on any 2 of its 3 cards', () => {
    const [cspHotel] = detectStaticOverlaps(
      valid({ wallet: ['chase-sapphire-preferred', 'amex-platinum'] }),
    );
    expect(cspHotel.rule_id).toBe('hotel-credit-no-stack');
    expect(cspHotel.benefit_ids).toEqual(['csp-hotel-credit', 'amex-platinum-hotel-credit']);
  });

  it('hotel rule lists all three benefit ids when all three cards are held', () => {
    const warnings = detectStaticOverlaps(
      valid({
        wallet: ['chase-sapphire-preferred', 'amex-platinum', 'bilt-palladium'],
        last_ge_application_date: undefined,
      }),
    );
    expect(warnings).toEqual([
      {
        rule_id: 'hotel-credit-no-stack',
        message: 'Multiple hotel portal credits held — one booking cannot use two portal credits.',
        benefit_ids: ['csp-hotel-credit', 'amex-platinum-hotel-credit', 'bilt-hotel-credit'],
      },
    ]);
  });

  it('wallet [hilton-amex-aspire, amex-platinum] yields exactly CLEAR+ and airline warnings', () => {
    expect(ruleIds(['hilton-amex-aspire', 'amex-platinum'])).toEqual([
      'clear-plus-reimbursement',
      'airline-credit-rules-differ',
    ]);
  });
});

describe('detectStaticOverlaps — registry firing semantics', () => {
  it('returns [] for an empty wallet without throwing', () => {
    expect(ruleIds([])).toEqual([]);
  });

  it('returns [] for unknown card ids (schema passes them; registry ignores them)', () => {
    expect(ruleIds(['ghost-card'])).toEqual([]);
    expect(ruleIds(['amex-platinum', 'ghost-card', 'hilton-amex-aspire'])[0]).toBe(
      'clear-plus-reimbursement',
    );
  });

  it("returns [] when fewer than 2 of any rule's cards are held", () => {
    expect(ruleIds(['chase-sapphire-preferred', 'hilton-amex-aspire'])).toEqual([]);
    expect(ruleIds(['amex-platinum', 'hilton-amex-surpass'])).toEqual([]);
    expect(ruleIds(['csp'])).toEqual([]);
  });

  it('emits warnings that all validate through OverlapWarningSchema', () => {
    const warnings = detectStaticOverlaps(
      valid({
        wallet: [
          'chase-sapphire-preferred',
          'amex-platinum',
          'bilt-palladium',
          'hilton-amex-aspire',
          'hilton-amex-surpass',
          'marriott-bonvoy-brilliant',
        ],
        last_ge_application_date: undefined,
      }),
    );
    expect(warnings.map((w) => w.rule_id)).toEqual([
      'clear-plus-reimbursement',
      'airline-credit-rules-differ',
      'hotel-credit-no-stack',
    ]);
    for (const w of warnings) expect(() => OverlapWarningSchema.parse(w)).not.toThrow();
  });

  it('ignores GE dates entirely (a missing GE date does not affect static rules)', () => {
    const withGe = detectStaticOverlaps(valid({ wallet: ['amex-platinum', 'hilton-amex-aspire'] }));
    const noGe = detectStaticOverlaps(
      valid({
        wallet: ['amex-platinum', 'hilton-amex-aspire'],
        last_ge_application_date: undefined,
      }),
    );
    expect(withGe).toEqual(noGe);
  });

  it('re-parses input with OverlapInputSchema — duplicates reject before evaluation', () => {
    expect(() =>
      detectStaticOverlaps({ ...BASE, wallet: ['amex-platinum', 'amex-platinum'] }),
    ).toThrow(/duplicate card id amex-platinum/);
  });
});
