# Sub-job 004-t2 — Overlap rule registry + 3 static rules (refined prompt)

Parent: 004-roi-overlap-rules. Depends on: **004-roi-overlap-rules-t1**
(merged; consumes its `OverlapInputSchema`). Semantics CONFIRMED in parent
`answers.md` / `spec.md` (AC5).

## Summary

Add `packages/rules/src/overlap/rules.ts`: a rule registry mapping stable
`rule_id` → affected benefit ids + cards, and `detectOverlaps(input)` firing
a rule only when its affected cards are held. Implement three static rules
(doc §3.9):

- `clear-plus-overlap` — `amex-platinum-clear_plus` + `aspire-clear_plus`
- `hotel-portal-no-stack` — `csp-hotel-credit`, `amex-platinum-hotel-credit`, `bilt-hotel-credit`
- `airline-credit-distinct` — Platinum vs Aspire airline credits, informational message (distinct eligibility, not duplication)

Each warning: `{ rule_id, message, benefit_ids }` with stable `rule_id`.

## Files

- `packages/rules/src/overlap/rules.ts` (new)
- `packages/rules/src/overlap/rules.test.ts` (new)
- `packages/rules/src/index.ts` (export types/registry if public)

## Goals

1. Wallet [Aspire, Platinum] → exactly `clear-plus-overlap` and `airline-credit-distinct` warnings (hotel-portal needs other cards).
2. Wallet [CSP] alone → no warnings.
3. Wallet = all six cards → all three rules fire with the expected `benefit_ids` sets.
4. `detectOverlaps` returns `OverlapWarning[]`, sorted or ordered deterministically.

## Edge cases

1. Single-card wallet never fires a two-card rule.
2. Empty wallet → empty array, no throw.
3. Unknown card id in wallet → defined behavior (ignore or reject), asserted.
4. Warning objects are data only — no dates, no evaluation of time-aware rules here (t4 adds GE).
