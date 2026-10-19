# Job 003 — Reset engine (refined prompt)

Mode: **feature**. User answered all four open questions in `answers.md` —
everything below is CONFIRMED; no open questions remain.

## Diagnosis

- The raw request names 8 anchor types from doc §3.2, but the shipped catalog
  (`packages/catalog/src/benefit.ts`) defines **13** `ResetAnchor` variants
  including non-periodic ones (`none`, `ongoing`, `per_stay`, `per_purchase`,
  `per_booking`). The engine must define behavior for all 13, not just 8.
- "Spend-threshold (no period; consumed by tracker job)" conflicts with the
  catalog: `spend_threshold` anchors carry `threshold_cents` and the
  backlog's ROI/threshold item consumes them — this job must decide whether
  they produce instances at all (they don't) and document that contract.
- "Card open/anniversary/fee dates" are `UserCard` fields (doc §6) that don't
  exist yet — no API, no db, no Zod schema for them. This job must define the
  input type (dates-only, no user_id) since `apps/api` job later persists it.
- "Mid-year card opening (first period prorated/flagged)" offered two
  behaviors ("or"); the doc §7 says the same. One must be chosen — amounts are
  integer cents and prorating invites rounding disputes.
- Job 002 left an open follow-up: `multi_year` anchors with
  `interval_years !== 4` get mislabeled `every_4_years` by the catalog's
  cadence transform. This job owns deciding handle-vs-reject since the engine
  is the consumer.
- Timezone policy is unstated: all dates are `YYYY-MM-DD` strings with no tz.
  Doc §7 says "user's local midnight with a one-day safety margin" — the
  engine needs an explicit, testable boundary convention (inclusive/exclusive
  period ends, "as of" on a boundary).

## Assumptions

1. Input is a dates-only `UserCardDates` object (`open_date`, `anniversary_date?`,
   `fee_date?` — all `YYYY-MM-DD`), the catalog `Benefit`, and `as_of` date.
   No user_id, no db, no user toggles (track/ignore/enrolled are Phase 2 API
   concerns). Zod-validated in `packages/rules` (or `packages/shared` if
   cleaner) since the API job will reuse it for `UserCard`.
2. Output is a `BenefitInstance` period list shaped per doc §6:
   `benefit_id`, `period_start`, `period_end` (ISO dates),
   `amount_available_cents`, `status` (unused/partial/used/expired derived
   elsewhere — engine emits `unused` default + `expired` for past periods with
   no usage tracking here), plus a `prorated: boolean` flag. Usage/amount_used
   live in the future API/db, so the engine emits `amount_available_cents`
   and period bounds only; status computation stays trivial here.
3. Period boundaries: `period_start` inclusive, `period_end` inclusive at
   23:59:59 local; a period is included when `period_start <= as_of`. `as_of`
   exactly equal to a `period_start` starts the new period; exactly equal to a
   `period_end` keeps that period as current (one-day safety margin, doc §7).
4. [CONFIRMED by user] Mid-year opening: **flag, never prorate** — first
   period gets the **full** `amount_cents` with `prorated: true` when
   `period_start < open_date`. Amounts are never scaled. Matches doc §7
   ("many credits are available immediately on open").
5. [CONFIRMED by user] `anniversary` anchor uses `anniversary_date` (falls
   back to `open_date`'s month/day); `renewal` emits **one immediate instance
   at `open_date`** (doc §5.3 "on approval"), then renewal-cycle periods
   anchored to `fee_date` (falls back to `anniversary_date`, then
   `open_date`). First period starts at the first occurrence of the anchor
   on/after `max(open_date, effective_from)`.
6. [CONFIRMED by user] Non-periodic anchors: `ongoing`/`none`/`per_stay`/
   `per_purchase`/`per_booking` and `spend_threshold` produce **zero
   instances** — the function returns a discriminated result
   `{ kind: 'periods', instances } | { kind: 'no_periods', reason }`, never a
   silent empty list, never an exception. Spend thresholds are consumed by
   the later threshold-tracker work, not here.
7. [CONFIRMED by user] `multi_year` with `interval_years === 4` generates
   periods anchored to `open_date` anniversary; intervals ≠ 4 are **supported
   generically** (anchor math is the same, the engine trusts `interval_years`).
   The catalog's `every_4_years` cadence-label fix is **out of scope** —
   it stays on the job-002 follow-ups backlog item.
8. `status === 'retired'` (or `effective_to < as_of`): no instances with
   `period_start > effective_to`, but past instances within
   `[effective_from, effective_to]` are still generated (history preserved,
   doc §7). `grandfathered`/`changed` behave as `active` for generation.
9. Leap-day anniversaries (Feb 29): non-leap years roll to Feb 28 (doc §7
   one-day safety margin in the user's favor).
10. Pure functions, integer cents, no date libraries beyond a tiny internal
    date module (no `date-fns`/`luxon` — keep deps at zod + existing).
11. History generation: the engine generates **all** periods from first
    period start to `as_of`, not just the current one — the API's
    `GET /cards/:id/benefits` needs the list; bounded by an explicit
    max-instances guard (e.g. reject/flag when generating > 600 periods).

## Open questions

None — the user answered all four questions (proration flag-only, renewal
first instance on approval, discriminated no-period result, catalog label
fix out of scope). Answers are recorded in `factory/jobs/003-reset-engine/answers.md`.

## Refined prompt

**P1 (single job — not split; all goals are one package's pure functions):**

Build `packages/rules` reset engine. Export
`generateBenefitInstances(input: { benefit: Benefit; cardDates: UserCardDates;
asOf: string })` plus per-anchor helpers, returning the discriminated
period result described in assumptions 2/3. Implement period math for every
catalog `ResetAnchor` variant: `calendar_year`, `half_year` (Jan–Jun / Jul–Dec),
`quarter`, `month`, `anniversary`, `renewal`, `multi_year(interval_years)`;
and the explicit no-period contract for `none`, `ongoing`, `per_stay`,
`per_purchase`, `per_booking`, `spend_threshold`. Define the
`UserCardDates` Zod schema this package owns (the API job will lift it into
`UserCard`). All dates `YYYY-MM-DD` strings; period end inclusive;
`as_of`-on-boundary resolves to the newer period per assumption 3. Retired
benefits generate history only (assumption 8). No db, no HTTP, no I/O, no new
runtime deps beyond zod. Exhaustive Vitest coverage with doc §7 as the test
matrix. Update the repo-root README architecture map only if it names
`packages/rules` internals.

## Goals

1. `generateBenefitInstances({ benefit: csp-hotel-credit (anniversary), cardDates:
   { open_date: 2026-03-10, anniversary_date: 2026-03-10 }, asOf: 2027-03-10 })`
   → 2 instances: 2026-03-10→2027-03-09 and 2027-03-10→2028-03-09; the second
   is current (as_of == period_start).
2. Amex digital entertainment credit (month anchor), open 2026-03-10,
   asOf 2026-03-31 → one instance 2026-03-01→2026-03-31 with `prorated: true`
   (period starts before open_date) and **full** amount — amounts are never
   scaled (confirmed).
3. Half-year anchor (Bilt hotel credit), asOf 2026-07-01 → the Jul–Dec
   instance is current (boundary = new period wins).
4. `multi_year` interval_years 4 (csp-global-entry), open 2026-10-01,
   asOf 2029-12-31 → exactly 1 instance 2026-10-01→2030-09-30; interval_years 3
   with same input → 1 instance ending 2029-09-30 (generic support, confirmed —
   the engine trusts `interval_years`; the catalog label fix is out of scope).
5. Retired Saks (status retired, effective_to 2026-07-31), asOf 2027-01-01 →
   instances only within effective range (here: the anchor is `none`, so zero
   periods — use a synthetic retired monthly benefit for the real assertion:
   instances exist for periods ≤ effective_to, none after).
6. `spend_threshold` / `ongoing` / `per_stay` / `per_purchase` / `per_booking` /
   `none` anchors → `{ kind: 'no_periods', reason: ... }` — never an empty
   silent list, never an exception (confirmed).
7. `renewal` anchor (e.g. Aspire Free Night), open 2026-06-15, fee_date
   2027-05-01, asOf 2027-06-01 → exactly 2 instances: an immediate one starting
   at `open_date` 2026-06-15, then a renewal-cycle period anchored to
   `fee_date` (confirmed: first instance fires on approval, then renewal
   periods per assumption 5).
8. Leap-day open 2024-02-29, anniversary anchor, asOf 2026-10-01 → periods
   2024-02-29→2025-02-28, 2025-02-28(29)→2026-02-28, 2026-02-28→2027-02-28
   — deterministic bounds per assumption 9.
9. Malformed input (bad date strings, missing open_date, `as_of` before
   open_date, benefit from a different card's catalog) → Zod/TypeError
   validation errors with clear messages, no partial output.
10. Guard: > 600 generated periods (e.g. monthly anchor, 100-year span) →
    explicit error, not a hang.
11. `pnpm -r test`, `pnpm -r lint`, `pnpm -r format:check` green; every test
    in the matrix maps to a named doc §7 edge case in a comment.

## Edge cases (test matrix, doc §7)

1. Anniversary vs calendar boundaries: CSP hotel credit (anniversary) and
   Bilt Cash (anniversary) vs Amex monthly/quarterly/semi-annual (calendar)
   — cross-year "as of" where the two diverge (e.g. as_of 2027-01-15: Amex
   calendar anchors start new periods, anniversary anchors don't).
2. Mid-year card opening: every period-generating anchor with open_date
   strictly inside a period → first instance flagged `prorated` with the
   **full** amount, bounds unchanged, amounts never scaled (confirmed).
3. Leap-day anniversaries (Feb 29 open) across non-leap years; also
   anniversary_date ≠ open_date month/day (re-set anniversary).
4. Boundaries exactly at "as of": as_of == period_start, == period_end,
   == effective_from, == effective_to — assert the inclusive/exclusive pick
   from assumption 3 in each.
5. Retired benefits: forward generation stops at effective_to; history
   preserved; `grandfathered`/`changed` still generate forward.
6. effective_from in the future (> as_of) → zero instances.
7. Renewal anchor: one immediate instance at `open_date` (on approval, doc
   §5.3), then renewal-cycle periods anchored to `fee_date` with fallback
   chain `anniversary_date` → `open_date` (confirmed); also test the
   fallbacks themselves (missing fee_date, missing both).
8. Adversarial input: empty/invalid dates, as_of before open_date,
   amount_cents null on a period-generating anchor (non-monetary benefits
   like Marriott Elite Night Credits — amount null but multi_year/calendar
   counting still applies), interval_years 1 (degenerates to annual),
   interval_years 0/negative rejected by input Zod.
9. Half-year boundary Jul 1 and Jan 1; quarter boundaries with as_of on each.
10. Timezone note: no tz anywhere; all comparisons on plain ISO dates;
    document the "one-day safety margin" convention in the package README or
    doc comments (no runtime tz code).
