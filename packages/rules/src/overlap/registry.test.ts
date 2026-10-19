// Static overlap rules (doc §3.9) + registry firing semantics, asserted
// against the t1 input contract (unknown ids pass; duplicates reject there).
// The t3 tests cover Priority Pass / Hilton Diamond; the t4 tests cover the
// time-aware Global Entry rule and the composed `detectOverlaps` entry point
// (exported from the package root).

import { describe, expect, it } from 'vitest';
import { OverlapInputSchema } from './input.js';
import {
  detectOverlaps,
  detectStaticOverlaps,
  OverlapWarningSchema,
  type OverlapWarning,
} from './registry.js';
import { detectOverlaps as detectOverlapsFromRoot } from '../index.js';

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

describe('detectStaticOverlaps — Priority Pass best path (t3)', () => {
  it('fires listing exactly the two held benefit ids for any 2 of its 3 cards', () => {
    const cases: [string[], string[]][] = [
      [
        ['hilton-amex-aspire', 'bilt-palladium'],
        ['aspire-lounge-access', 'bilt-priority-pass'],
      ],
      [
        ['hilton-amex-aspire', 'marriott-bonvoy-brilliant'],
        ['aspire-lounge-access', 'brilliant-priority-pass'],
      ],
      [
        ['bilt-palladium', 'marriott-bonvoy-brilliant'],
        ['bilt-priority-pass', 'brilliant-priority-pass'],
      ],
    ];
    for (const [wallet, benefitIds] of cases) {
      const warnings = detectStaticOverlaps(valid({ wallet, last_ge_application_date: undefined }));
      expect(warnings).toEqual([
        {
          rule_id: 'priority-pass-best-path',
          message:
            'Multiple Priority Pass memberships held — pick one card for lounge access; the others duplicate it.',
          benefit_ids: benefitIds,
        },
      ]);
    }
  });

  it('lists all three benefit ids when all three Priority Pass cards are held', () => {
    const warnings = detectStaticOverlaps(
      valid({
        wallet: ['hilton-amex-aspire', 'bilt-palladium', 'marriott-bonvoy-brilliant'],
        last_ge_application_date: undefined,
      }),
    );
    expect(warnings).toEqual([
      {
        rule_id: 'priority-pass-best-path',
        message:
          'Multiple Priority Pass memberships held — pick one card for lounge access; the others duplicate it.',
        benefit_ids: ['aspire-lounge-access', 'bilt-priority-pass', 'brilliant-priority-pass'],
      },
    ]);
  });

  it('does not fire for a single Priority Pass card', () => {
    expect(ruleIds(['hilton-amex-aspire'])).toEqual([]);
    expect(ruleIds(['bilt-palladium'])).toEqual([]);
    expect(ruleIds(['marriott-bonvoy-brilliant'])).toEqual([]);
  });
});

describe('detectStaticOverlaps — Hilton Diamond redundancy (t3)', () => {
  it('fires for [hilton-amex-aspire, hilton-amex-surpass] naming the redundant Gold status', () => {
    const warnings = detectStaticOverlaps(
      valid({
        wallet: ['hilton-amex-aspire', 'hilton-amex-surpass'],
        last_ge_application_date: undefined,
      }),
    );
    expect(warnings).toEqual([
      {
        rule_id: 'hilton-diamond-redundant',
        message: "Aspire's Hilton Diamond status makes Surpass's automatic Gold status redundant.",
        benefit_ids: ['aspire-diamond-status', 'surpass-gold-status'],
      },
    ]);
  });

  it('is directional — neither card alone fires it', () => {
    expect(ruleIds(['hilton-amex-aspire'])).toEqual([]);
    expect(ruleIds(['hilton-amex-surpass'])).toEqual([]);
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

  it('full six-card wallet yields exactly 5 warnings, all valid through OverlapWarningSchema', () => {
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
      'priority-pass-best-path',
      'hilton-diamond-redundant',
    ]);
    expect(warnings).toHaveLength(5);
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

const SIX_CARDS = [
  'chase-sapphire-preferred',
  'amex-platinum',
  'hilton-amex-aspire',
  'hilton-amex-surpass',
  'bilt-palladium',
  'marriott-bonvoy-brilliant',
] as const;

const GE_CARDS = ['chase-sapphire-preferred', 'marriott-bonvoy-brilliant'] as const;

const geRule = (warnings: OverlapWarning[]) =>
  warnings.find((w) => w.rule_id === 'global-entry-overlap');

describe('detectOverlaps — time-aware Global Entry rule (t4)', () => {
  it('six-card wallet, date = asOf − 1y → static rules + GE on both GE benefit ids', () => {
    const warnings = detectOverlaps(
      valid({ wallet: [...SIX_CARDS], last_ge_application_date: '2025-06-01' }),
    );
    // t3's Priority Pass + Hilton Diamond merged: all five static rules + GE
    // = six warnings (parent AC5).
    expect(warnings.map((w) => w.rule_id)).toEqual([
      'clear-plus-reimbursement',
      'airline-credit-rules-differ',
      'hotel-credit-no-stack',
      'priority-pass-best-path',
      'hilton-diamond-redundant',
      'global-entry-overlap',
    ]);
    expect(geRule(warnings)?.benefit_ids).toEqual(['csp-global-entry', 'brilliant-global-entry']);
  });

  it('boundary: date = asOf − 4y → coverage expires exactly at asOf → no GE warning', () => {
    const warnings = detectOverlaps(
      valid({ wallet: [...GE_CARDS], last_ge_application_date: '2022-06-01' }),
    );
    expect(geRule(warnings)).toBeUndefined();
  });

  it('date = asOf − 4y − 1d → coverage long expired → no GE warning', () => {
    const warnings = detectOverlaps(
      valid({ wallet: [...GE_CARDS], last_ge_application_date: '2022-05-31' }),
    );
    expect(geRule(warnings)).toBeUndefined();
  });

  it('date = asOf − 3y → coverage still active → GE warning fires', () => {
    const warnings = detectOverlaps(
      valid({ wallet: [...GE_CARDS], last_ge_application_date: '2023-06-01' }),
    );
    expect(geRule(warnings)?.benefit_ids).toEqual(['csp-global-entry', 'brilliant-global-entry']);
  });

  it('missing date with GE cards held → no GE warning; static rules fire exactly as in t2', () => {
    const wallet = ['amex-platinum', 'hilton-amex-aspire', 'chase-sapphire-preferred'];
    const withoutDate = detectOverlaps(valid({ wallet, last_ge_application_date: undefined }));
    expect(geRule(withoutDate)).toBeUndefined();
    expect(withoutDate).toEqual(
      detectStaticOverlaps(valid({ wallet, last_ge_application_date: undefined })),
    );
    expect(withoutDate.map((w) => w.rule_id)).toEqual([
      'clear-plus-reimbursement',
      'airline-credit-rules-differ',
      'hotel-credit-no-stack',
    ]);
  });

  it('GE benefit ids follow the held cards (CSP alone → csp-global-entry)', () => {
    const warnings = detectOverlaps(
      valid({
        wallet: ['chase-sapphire-preferred', 'amex-platinum'],
        last_ge_application_date: '2025-06-01',
      }),
    );
    expect(geRule(warnings)?.benefit_ids).toEqual(['csp-global-entry']);
  });

  it('no GE card held → no GE warning, date present or absent', () => {
    const present = detectOverlaps(
      valid({
        wallet: ['amex-platinum', 'hilton-amex-aspire'],
        last_ge_application_date: '2025-06-01',
      }),
    );
    const absent = detectOverlaps(
      valid({
        wallet: ['amex-platinum', 'hilton-amex-aspire'],
        last_ge_application_date: undefined,
      }),
    );
    expect(geRule(present)).toBeUndefined();
    expect(geRule(absent)).toBeUndefined();
  });

  it('future last_ge_application_date → no GE warning (not a completed application)', () => {
    const warnings = detectOverlaps(
      valid({ wallet: [...GE_CARDS], last_ge_application_date: '2027-06-01' }),
    );
    expect(geRule(warnings)).toBeUndefined();
  });

  it('is the same function exported from the package root', () => {
    expect(detectOverlapsFromRoot).toBe(detectOverlaps);
  });

  it('malformed dates reject in OverlapInputSchema before reaching the rule', () => {
    expect(() =>
      detectOverlaps({ ...BASE, wallet: [...GE_CARDS], last_ge_application_date: '2026-13-45' }),
    ).toThrow(/ISO date/);
  });
});
