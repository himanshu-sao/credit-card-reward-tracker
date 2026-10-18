# Job 004 — ROI math and overlap detection rules (refined prompt)

All four open questions were answered by the user (see `answers.md`); every answer is CONFIRMED or adopted below. No open questions remain.

## Diagnosis

- The raw text names ROI quantities (fee, face value, value used, net) but never defines the **computation window** — "annual fee" vs. which periods' value (current period? trailing 12 months? all history?). ROI is meaningless without a window.
- It says "usage/valuation input shape you must define" but gives no hint of the shape; risk of designing it around the future API instead of the math, or vice versa.
- "Retired benefits excluded forward but included for past periods" conflates two mechanisms: instance generation (job 003 already stops forward generation on retired status) and value accounting (which generated periods count). Needs a precise rule.
- "Cents-per-point conversion for points-valued benefits" — the catalog has no points-quantity field (free-night awards are `amount_cents: null` with prose descriptors), so there is nothing to convert unless the points amount is an explicit input. This must be defined, not assumed from catalog data.
- Overlap rules are listed as prose; none specify inputs — §3.9 says "with these six cards", but the wallet may hold any subset, so the rules need a wallet-scoped trigger condition.

## Assumptions

1. **One coherent deliverable, no split.** (a) ROI math and (b) overlap rules share the same input shape (benefits × instances × wallet) and both are pure functions landing in `packages/rules/src/roi/` and `packages/rules/src/overlap/`; splitting would duplicate the input-shape work. The backlog lists them as one item. Branch `factory/004-roi-overlap-rules`.
2. **ROI window = trailing 12 months ending at `asOf`** — CONFIRMED (answers.md Q1): an instance counts iff its `[period_start, period_end]` overlaps `[asOf − 12 months, asOf]`, at full face value (amounts are never scaled, per job 003 / doc §7). Trailing-12 keeps mid-year-opened cards comparable across mixed anniversary/calendar anchors. The function also returns per-benefit and per-instance detail so the UI can re-window without regenerating.
3. **Net positions — CONFIRMED (answers.md Q2): both returned.** `computeCardRoi` returns the realized position `net_used_cents = value_used_cents − fee_cents` and the potential position `net_available_cents = face_value_available_cents − fee_cents`, so the UI can show them separately.
4. **Usage input** (pure-function contract; the Phase-2 API persists it later): per benefit_instance — `amount_used_cents` (integer, 0..`amount_available_cents`); usage above the cap is a Zod input error here (the API will enforce the 422 there). **Valuation input**: per benefit_id `value_pct` (0–100, default 100) and per currency_id `cents_per_point` (default = catalog `default_cents_per_point`).
5. **Points-valued benefits**: any benefit may carry an optional `points_amount` in the input; its face value = `points_amount × cents_per_point` for that card's `currency_id`. No points amount → contributes zero face value (matches non-monetary catalog rows like "Status"). Applying a points amount to a benefit that already has `amount_cents` is rejected.
6. **Retired rule**: an instance of a retired benefit counts iff `instance.period_start <= benefit.effective_to` (Saks: `effective_to = 2026-07-31` — history in, forward out). Mirrors job 003's generation semantics.
7. **Overlap functions take the user's wallet** (list of catalog card ids held); a rule fires only when its affected cards are held. **Global Entry is time-aware — user's choice (answers.md Q3), overriding the refiner's static-only guess**: the input contract includes a caller-supplied `last_ge_application_date` (persisted later by the Phase-2 API, like usage/valuations); the GE rule warns only when a new application's 4-year coverage window would overlap the existing one — i.e. when the new application's start date falls before the existing coverage (last application + 4 years) expires. Catalog coverage stays `csp-global-entry` + `brilliant-global-entry` only (Platinum has no GE row). Other rules: CLEAR+ (`amex-platinum-clear_plus` + `aspire-clear_plus`); hotel portal credits can't stack (`csp-hotel-credit`, `amex-platinum-hotel-credit`, `bilt-hotel-credit`); airline credit rules (Platinum one-airline annual vs Aspire quarterly — informational, distinct eligibility); Priority Pass best-path (`aspire-lounge-access`, `bilt-priority-pass`, `brilliant-priority-pass`); Hilton Diamond redundancy (`aspire-diamond-status` makes `surpass-gold-status` redundant — doc says "show in ROI view", so `computeCardRoi` accepts overlap results and marks redundant benefit ids in its per-benefit breakdown). Each rule returns `{ rule_id, message, benefit_ids }` with a stable `rule_id`.
8. **Break-even projection and renewal keep/downgrade/cancel summary are out of scope — CONFIRMED (answers.md Q4).** Deferred until usage-pace data exists (Phase-2 API), matching the backlog's later ROI-screen item. This job ships the P0 core only.
9. All money integer cents, no floats. No db, no HTTP, no new env vars. Zod schemas for every public input/output, exported from `src/index.ts`, matching job 003's style; job 003's public API is untouched.

## Open questions

None — all four were answered by the user and recorded in `answers.md` (Q1 trailing-12 window, Q2 both net positions, Q3 time-aware Global Entry, Q4 break-even/renewal deferred). The assumptions, goals, and edge cases below already incorporate those answers.

## Refined prompt

**P1 (single job).** Add to `packages/rules`:

- `src/roi/`: `computeCardRoi(input) → CardRoi` — per card: `fee_cents`, `face_value_available_cents`, `value_used_cents`, both net positions (`net_used_cents` realized, `net_available_cents` potential, per assumption 3), and a per-benefit breakdown honoring `value_pct` (realistic-value mode), cents-per-point for points amounts, and the retired-forward rule (assumption 6). Input: card, its benefits, instances from `generateBenefitInstances`, usage records, valuations, `asOf`.
- `src/overlap/`: `detectOverlaps(input) → OverlapWarning[]` — the six doc §3.9 rules as data-driven pure functions over the wallet's held card ids and the catalog's benefit ids; each warning carries a stable `rule_id`, human message, and affected `benefit_ids`. The input includes the caller-supplied `last_ge_application_date` for the time-aware Global Entry rule (assumption 7): the warning fires only when a new application's coverage start falls before the existing 4-year coverage expires.
- Zod schemas for all public inputs/outputs; export from `src/index.ts`.
- Unit tests carrying the doc's worked examples (§1.5 fee total, §3.6 realistic-value example, §3.9 six warnings, §5.2/§7 Saks retirement) plus GE date cases in both directions.
- Document the usage/valuation/GE-application-date input contract (doc comment or package README section) so the Phase-2 API job consumes it verbatim; update the product doc only if shipped behavior diverges from it.

## Goals

1. `computeCardRoi` for CSP (fee 9500) with a fully-unused $100 anniversary-year benefit → `face_value_available_cents = 10000`, `value_used_cents = 0`, `net_used_cents = -9500`, `net_available_cents = 500`.
2. Same card with `value_pct: 55` on that benefit → realistic face value 5500, `net_available_cents = -4000`.
3. Amex Platinum with Saks: an instance ending ≤ 2026-07-31 counts toward past-period ROI; any instance with `period_start > 2026-07-31` is excluded; test asserts both directions. Portfolio fee total across all six cards = 283500.
4. `aspire-free-night-reward` with `points_amount: 85000` and Hilton `cents_per_point: 0.6` → face value 51000 cents.
5. `detectOverlaps` with wallet = all six cards and a `last_ge_application_date` whose 4-year window would be overlapped by a new application (e.g. `asOf − 1 year`) → exactly six warnings including the GE warning on `csp-global-entry` + `brilliant-global-entry`; wallet = [CSP] → none; wallet = [Aspire, Platinum] → CLEAR+ and airline-credit warnings only (hotel-portal and Priority Pass rules need other cards held).
6. Time-aware GE, no-warning direction: wallet holds CSP and Brilliant with `last_ge_application_date = asOf − 4 years − 1 day` (old coverage expired) → no GE warning, even though both cards are held; with `last_ge_application_date = asOf − 3 years` → GE warning fires. Test asserts both.
7. Usage above cap, negative cents, malformed ISO dates, unknown benefit ids, malformed `last_ge_application_date` → ZodError; never NaN or silent zero.
8. `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` green.

## Edge cases

1. Card opened mid-year: first (prorated-flagged) instance counted at full value in the window.
2. Instance straddling the window start (period_start before, period_end inside) — counted at full value; asserted in test.
3. `value_pct` 0 and 100 boundaries; `cents_per_point` below and above the catalog default.
4. Benefits with `no_periods` results (ongoing status, spend-threshold) — contribute nothing to face value unless a points_amount is supplied; no crash.
5. Overlap input with duplicate card ids, empty wallet, unknown card ids — Zod reject or empty result, no throw.
6. Usage exactly equal to cap (valid) vs one cent over (reject).
7. Retired benefit whose entire history predates the card's open date — zero contribution.
8. Empty instances + zero usage + default valuations — ROI is fee and negative net only.
9. GE boundary dates: `last_ge_application_date` exactly `asOf − 4 years` (old coverage expires exactly at `asOf` — a new application starting at `asOf` does not overlap; decide and assert which way the boundary goes) vs one day earlier (warning fires); `last_ge_application_date` in the future or missing/absent while both GE cards are held — defined, tested behavior (missing date must not crash the other five rules).
