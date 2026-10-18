# Job 004 — ROI math and overlap detection rules (spec)

## Goal

Add the ROI math and the six doc §3.9 overlap rules to `packages/rules` as pure functions over the job-003 reset engine's outputs. `computeCardRoi` computes, per card and for a trailing-12-month window ending at `asOf`, both net positions (realized `used − fee` and potential `available − fee`) with realistic-value, cents-per-point, and retired-benefit semantics. `detectOverlaps` turns the doc's prose warnings into data-driven, wallet-scoped rules with stable `rule_id`s, including a time-aware Global Entry rule. No db, no HTTP, no I/O; zod is the only dependency. Job 003's public API is untouched.

## Approach

- `packages/rules/src/roi/` — `computeCardRoi(input) → CardRoi` and `src/overlap/` — `detectOverlaps(input) → OverlapWarning[]`, plus colocated Vitest files. New zod schemas follow job 003's style (see `src/result.ts`); all public inputs/outputs exported from `src/index.ts`.
- Input shape (shared vocabulary with job 003): a card, its benefits (from `@ccrt/catalog`), instances from `generateBenefitInstances`, usage records (`amount_used_cents` per benefit_instance, 0..`amount_available_cents`), valuations (`value_pct` per benefit_id, 0–100, default 100; `cents_per_point` per currency_id, default = catalog `default_cents_per_point`), and `asOf`. Points amounts are an optional `points_amount` input per benefit; face value = `points_amount × cents_per_point` for the card's `currency_id`; no points amount → zero face value; points amount on a benefit with `amount_cents` → zod reject.
- ROI semantics (user-confirmed): window = `[asOf − 12 months, asOf]`; an instance counts iff `[period_start, period_end]` overlaps it, at full face value (never prorated). Retired benefits: instance counts iff `period_start <= benefit.effective_to` (Saks `effective_to = 2026-07-31`). Output carries per-benefit and per-instance detail so the UI can re-window.
- Overlap rules are data over wallet card ids and catalog benefit ids, each returning `{ rule_id, message, benefit_ids }`; fire only when their affected cards are held. GE coverage = `csp-global-entry` + `brilliant-global-entry` only; warning fires only when a new application (starting at `asOf`) would start before the existing 4-year window from caller-supplied `last_ge_application_date` expires. `computeCardRoi` accepts overlap results to mark redundant benefit ids (Hilton Diamond case) in its per-benefit breakdown.
- Document the usage/valuation/GE-date input contract in a doc comment or package README section for the Phase-2 API. Out of scope: break-even projection, renewal keep/downgrade/cancel summary, persistence.
- Update the product doc and root README only if shipped behavior diverges.

## Acceptance criteria

1. `computeCardRoi`: CSP (fee 9500), fully-unused $100 anniversary-year benefit → `face_value_available_cents = 10000`, `value_used_cents = 0`, `net_used_cents = -9500`, `net_available_cents = 500`.
2. Same input with `value_pct: 55` → face value 5500, `net_available_cents = -4000`.
3. Amex Platinum Saks: an instance with `period_end <= 2026-07-31` counts; one with `period_start > 2026-07-31` is excluded; both directions asserted. Portfolio fee total across all six cards = 283500.
4. `aspire-free-night-reward` with `points_amount: 85000` and Hilton `cents_per_point: 0.6` → face value 51000 cents.
5. `detectOverlaps`, all six cards held, `last_ge_application_date = asOf − 1 year` → exactly six warnings, including GE on `csp-global-entry` + `brilliant-global-entry`. Wallet `[CSP]` → none; wallet `[Aspire, Platinum]` → CLEAR+ (`amex-platinum-clear_plus`, `aspire-clear_plus`) and airline-credit (`amex-platinum-airline-incidental-credit`, `aspire-flight-credit`) warnings only.
6. Time-aware GE both directions: CSP + Brilliant held, `last_ge_application_date = asOf − 4y − 1d` → no GE warning; `= asOf − 3y` → GE warning. Boundary `= asOf − 4y` (coverage expires exactly at `asOf` — no overlap) is decided and asserted in the test; missing or future `last_ge_application_date` is defined and tested and never breaks the other five rules.
7. Invalid inputs → ZodError, never NaN or silent zero: usage above cap, negative cents, malformed ISO dates, unknown benefit/card ids, points amount on a monetary benefit, malformed `last_ge_application_date`.
8. Edge cases asserted: mid-year-opened prorated instance counted at full value; instance straddling the window start counted in full; `value_pct` 0 and 100; `cents_per_point` below and above the catalog default; `no_periods` results (ongoing status, spend-threshold) contribute nothing unless a points_amount is supplied and don't crash; usage exactly at cap valid vs one cent over rejected; retired benefit whose history predates the card's open date contributes zero; empty instances + zero usage + default valuations → ROI is fee and negative nets only; overlap input with duplicate/unknown card ids or empty wallet → zod reject or empty result, no throw.
9. Green: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` (or `format:check`) all pass; job-003 exports unchanged.
10. Input contract documented (doc comment or README section) so the Phase-2 API job can consume it verbatim; product doc/README updated only on divergence.
