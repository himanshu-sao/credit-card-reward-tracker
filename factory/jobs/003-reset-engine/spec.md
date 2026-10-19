# Spec — Job 003: Reset engine (`packages/rules`)

## Goal

Build the reset/cadence engine in `packages/rules`: pure, Zod-validated
functions that turn a catalog `Benefit` (from `@ccrt/catalog`), a
dates-only `UserCardDates` input, and an `as_of` date into the full list of
`BenefitInstance` periods (doc §6 shape, integer cents), with explicit
behavior for every one of the 13 `ResetAnchor` variants in
`packages/catalog/src/benefit.ts`. No db, no HTTP, no I/O, no runtime deps
beyond zod. All refined-prompt assumptions are CONFIRMED; do not reopen any
question (see `answers.md`).

## Approach

- `packages/rules/src/`:
  - `dates.ts` — tiny internal ISO-date (`YYYY-MM-DD`) math module:
    parse/compare, add months/years, clamp-to-end-of-month (Feb 29 → Feb 28
    in non-leap years). No date libraries.
  - `user-card-dates.ts` — the `UserCardDates` Zod schema this package owns
    (`open_date` required; `anniversary_date`, `fee_date` optional; all ISO
    dates). The future API job lifts it into `UserCard` (doc §6).
  - `result.ts` (or co-located) — `BenefitInstance` Zod schema
    (`benefit_id`, `period_start`, `period_end`,
    `amount_available_cents`, `status`, `prorated: boolean`) and the
    discriminated result
    `{ kind: 'periods', instances } | { kind: 'no_periods', reason }`.
  - `generate.ts` — `generateBenefitInstances(input: { benefit: Benefit;
    cardDates: UserCardDates; asOf: string })` plus exported per-anchor
    helpers. Period-generating anchors: `calendar_year`, `half_year`
    (Jan–Jun / Jul–Dec), `quarter`, `month`, `anniversary`,
    `renewal`, `multi_year(interval_years)`. No-periods anchors:
    `none`, `ongoing`, `per_stay`, `per_purchase`, `per_booking`,
    `spend_threshold`.
  - `index.ts` — public exports (keep `RULES_ENGINE_NAME`).
  - Tests in `*.test.ts` next to sources, using the real catalog seed
    benefits where applicable (csp-hotel-credit, Amex credits, Aspire Free
    Night, etc.) plus synthetic benefits for retired/retired-monthly cases.
- Follow existing package conventions: workspace imports of
  `@ccrt/catalog` / `@ccrt/shared`, `zod` only, Prettier 100-char lines,
  ESLint.
- README: repo-root README names `packages/rules` only as a one-line
  summary — do not touch it. No HTTP-level checks needed (pure library).
- Key confirmed semantics (refined-prompt assumptions): period ends
  inclusive (23:59:59 local); period included when `period_start <= as_of`;
  `as_of == period_start` → new period is current, `as_of == period_end` →
  period stays current (one-day safety margin). Mid-year opening: flag
  `prorated: true`, never scale amounts. `renewal`: one immediate instance
  at `open_date`, then fee-date-anchored cycles (fallback
  `fee_date` → `anniversary_date` → `open_date`); first period anchored at
  first occurrence on/after `max(open_date, effective_from)`. `retired` /
  `effective_to < as_of`: history only. `multi_year` trusts
  `interval_years` generically (catalog's `every_4_years` label fix stays
  on the job-002 backlog — out of scope). Engine generates all periods from
  first period start to `as_of`, bounded by a >600-period guard error.

## Acceptance criteria

All checks runnable via `pnpm --filter @ccrt/rules test`; green job =
`pnpm -r test`, `pnpm -r lint`, `pnpm -r format:check` all pass. Every
test must carry a comment naming its doc §7 edge case (or refined-prompt
goal number).

1. **CSP anniversary (Goal 1):** `generateBenefitInstances` with
   csp-hotel-credit, `open_date: 2026-03-10`, `anniversary_date:
   2026-03-10`, `asOf: 2027-03-10` returns exactly 2 instances:
   2026-03-10→2027-03-09 and 2027-03-10→2028-03-09; the second is current
   (as_of == period_start).
2. **Mid-year monthly, flag-only (Goal 2):** Amex digital entertainment
   credit (month anchor), open 2026-03-10, asOf 2026-03-31 → one instance
   2026-03-01→2026-03-31 with `prorated: true` and the **full**
   `amount_cents` — amounts never scaled.
3. **Half-year boundary (Goal 3):** Bilt hotel credit (half_year), asOf
   2026-07-01 → the Jul–Dec instance exists and is current (boundary =
   new period wins). Same convention tested at Jan 1 and at each quarter
   boundary.
4. **Multi-year generic (Goal 4):** csp-global-entry (`multi_year`,
   interval_years 4), open 2026-10-01, asOf 2029-12-31 → exactly 1 instance
   2026-10-01→2030-09-30. Same input with `interval_years: 3` → 1 instance
   ending 2029-09-30. Also: `interval_years: 1` degenerates to annual;
   `interval_years: 0`/negative is rejected by input Zod (Zod parse fails,
   not the engine).
5. **No-periods contract (Goal 6, assumption 6):** `none`, `ongoing`,
   `per_stay`, `per_purchase`, `per_booking`, and `spend_threshold`
   anchors all return `{ kind: 'no_periods', reason: ... }` — never a
   silent empty list, never an exception; `spend_threshold`'s reason
   documents that threshold tracking consumes it (out of scope here).
6. **Renewal (Goal 7, assumption 5):** Aspire Free Night, open 2026-06-15,
   fee_date 2027-05-01, asOf 2027-06-01 → exactly 2 instances: one starting
   at `open_date` 2026-06-15 (fires on approval, doc §5.3), then a
   renewal-cycle period anchored to `fee_date`. Fallback tests: missing
   `fee_date` → `anniversary_date`; missing both → `open_date`.
7. **Retired = history only (Goal 5, assumption 8):** a synthetic retired
   *monthly* benefit with `effective_to: 2026-07-31`, asOf 2027-01-01 →
   instances exist for periods starting ≤ effective_to, none after.
   `grandfathered` and `changed` statuses generate forward like `active`.
   `effective_from > asOf` → zero instances (result kind is `periods`
   with an empty list, distinct from `no_periods`).
8. **Leap day (Goal 8, assumption 9):** open 2024-02-29, anniversary
   anchor, asOf 2026-10-01 → deterministic periods per refined-prompt
   bounds; also test `anniversary_date` differing from `open_date`
   month/day (re-set anniversary).
9. **Malformed input (Goal 9):** bad date strings, missing `open_date`,
   `as_of` before `open_date` → Zod/TypeError with clear messages and no
   partial output. Non-monetary benefits (`amount_cents: null` on a
   period-generating anchor, e.g. Marriott Elite Night Credits) still
   generate periods.
10. **600-period guard (Goal 10):** a monthly anchor over a ~100-year span
    → explicit error (not a hang, not an unbounded array).
11. **Boundaries (Edge case 4):** as_of == `period_start`, ==
    `period_end`, == `effective_from`, == `effective_to` each asserted
    against the inclusive/exclusive pick (as_of on `effective_to` keeps
    that period per the safety-margin rule).
12. **Cross-anchor divergence (Edge case 1):** asOf 2027-01-15 — Amex
    calendar anchors (month/quarter/half_year/calendar_year) start new
    periods; anniversary-anchored benefits (CSP hotel credit, Bilt Cash)
    do not.
13. **Timezone convention documented (Edge case 10):** no tz runtime code;
    the "one-day safety margin" and inclusive-end conventions are written
    in `packages/rules/src/` doc comments (and package README if one is
    added).
14. **Purity and deps:** `packages/rules/package.json` gains no runtime
    deps beyond zod; no `fetch`, db, fs, or HTTP imports in `src/`.
15. **Repo green:** `pnpm -r test`, `pnpm -r lint`, `pnpm -r format:check`
    all pass; repo-root README untouched.
