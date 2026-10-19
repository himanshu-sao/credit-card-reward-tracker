# Sub-job 004-t3 — Priority Pass + Hilton Diamond rules (refined prompt)

Parent: 004-roi-overlap-rules. Depends on: **004-roi-overlap-rules-t2**
(merged; extends its rule registry). Semantics CONFIRMED in parent
`answers.md` / `spec.md` (AC5).

## Summary

Extend `packages/rules/src/overlap/rules.ts` with two more doc §3.9 rules:

- `priority-pass-best-path` — `aspire-lounge-access`, `bilt-priority-pass`, `brilliant-priority-pass`
- `hilton-diamond-redundant` — Aspire's `aspire-diamond-status` makes Surpass's `surpass-gold-status` redundant

Same `{ rule_id, message, benefit_ids }` shape, same fire-only-when-held
semantics, same registry pattern as t2's three rules.

## Files

- `packages/rules/src/overlap/rules.ts` (extend)
- `packages/rules/src/overlap/rules.test.ts` (extend)

## Goals

1. Wallet with Aspire + Surpass → `hilton-diamond-redundant` fires, naming `surpass-gold-status` among `benefit_ids`.
2. Wallet with two Priority Pass cards (any two of Aspire/Bilt/Brilliant) → `priority-pass-best-path` fires.
3. Full six-card wallet → all five rules so far (t2's three + these two) present; count = 5.
4. Overlap warnings remain pure data — no ROI mutation here (t7 consumes them).

## Edge cases

1. Aspire held without Surpass → no diamond warning.
2. Surpass held without Aspire → no diamond warning (rule is directional: Aspire's status degrades Surpass's).
3. Only one Priority Pass card → no best-path warning.
