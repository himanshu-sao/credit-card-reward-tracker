# Refined prompt — 002-benefit-catalog

## Diagnosis
- `packages/catalog` is a placeholder (one `CatalogEntry` type + smoke test); this job makes its exports the domain contract consumed by the reset-engine, ROI, API and web jobs.
- Doc §5 is authoritative seed data: six cards, ~50 benefit rows, with per-row *Confirmed*/*Verify* status, a retired Saks row, and split/period amounts ("two $300 credits, semi-annual").
- §6 fixes the Benefit fields; §3.2 fixes the reset-anchor and lifecycle enums; §3.6 fixes the five point currencies; §1.5 fixes the $2,535 fee total — all directly testable.
- The doc mandates `source_url` per benefit (§3.2) but §5 tables and §13 give source *descriptions*, not URLs — values must be chosen, see open questions.
- The catalog depends on `@ccrt/shared` (already wired); no new deps beyond existing `zod`.

## Assumptions
1. Types, Zod schemas, and seed data all live in `packages/catalog` (exported from `src/index.ts`); `packages/shared` stays minimal. Rationale: the catalog is the versioned domain content; shared is for client/server wire types the API job will add.
2. Cents-per-point currencies (MR, UR, Hilton Honors, Marriott Bonvoy, Bilt Points) live in **catalog** as seeded `Currency` entities (id, program name, default cents-per-point). Rationale: they are catalog content versioned with the cards (doc §6 `UserValuation` references `currency_id`), and the ROI job consumes them via the catalog export; only the user's override belongs to a later API/user job.
3. Money is stored in integer cents (`amount_cents`, `fee_cents`, `threshold_cents`); no floats. `amount_cents` is nullable for non-monetary rows (statuses, earning rates, free nights), which carry a `value_descriptor` string instead.
4. `verification` is a required enum: `"confirmed"` for doc-*Confirmed* rows, `"verify"` for doc-*Verify* rows, each Verify row carrying the doc's note verbatim in a note field. This is the doc's documented flag, not missing data.
5. Split credits ("two $300 semi-annual", "four $50 quarterly") are one benefit row with `reset_anchor` matching the tranche period (half-year / quarter) and `amount_cents` per period (30000 / 5000); tranche multiplicity is recorded in a note. Period *generation* is the later rules job's concern.
6. `status` enum: `active` / `changed` / `retired` / `grandfathered` (§3.2). Saks row: `retired` with `effective_to` = 2026-07 (doc: "Retired July 2026"); all other rows `active`.
7. Reset anchors (§3.2): `calendar_year`, `half_year`, `quarter`, `month`, `anniversary`, `renewal`, `multi_year` (with `interval_years`, e.g. Global Entry = 4), `spend_threshold` (with `threshold_cents`), plus `ongoing` / `per_stay` / `per_purchase` / `per_booking` for non-resetting rows.

## Open questions
1. Doc gives no per-benefit URLs — what goes in `source_url` for each row? Guess: the issuer's official card/benefit page for that card (one URL per card is acceptable, per-benefit URLs preferred); `last_verified_at` = 2026-10-15 (doc compile date, §13).
2. `effective_from` for rows with no stated date (most rows; only CSP hotel credit 2026-06-15 and Saks 2026-07 have explicit dates)? Guess: `effective_from` = 2026-10-01, `effective_to` = null.
3. Amex Platinum "Flights/prepaid hotels earning" says "annual cap per sources" without a number. Guess: leave cap out of structured fields, record the doc's wording in the note.
4. CLEAR+ is "~$209 (sources show $189–$219)". Guess: `amount_cents` = 20900 with the range recorded in the note.

## Refined prompt
Build the benefit-catalog package. In `packages/catalog/src/`, define Zod schemas + inferred TS types for `Card` (issuer, name, annual fee, network, reward currency id), `Currency` (point program + default cents-per-point), and `Benefit` with exactly the §6 fields: card_id, name, category, amount_cents, value_descriptor, cadence, reset_anchor (+interval_years/threshold_cents where applicable), rules (eligible merchants, minimums, portal requirement), enrollment_required, status, verification (+note), effective_from, effective_to, source_url, last_verified_at. Seed the six cards from doc §1.5 and every benefit row from doc §5 (all four table columns represented), including the retired Saks row, all *Verify* flags, and the five point currencies from §3.6. Export typed helpers: `cards`, `currencies`, `allBenefits`, `activeBenefits` (excludes `retired`). Replace the placeholder `CatalogEntry`. Unit tests must prove schema strictness, doc-fact parity, and totals. No API, DB, or UI work in this job; `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` must all pass.

## Goals
1. Schema strictness: feeding a benefit row with an invalid `status`/`cadence`/`reset_anchor` enum value, a missing `source_url`, a negative `amount_cents`, a malformed `effective_from`, or a `multi_year` anchor missing `interval_years` → `safeParse` fails; every seeded row parses cleanly.
2. Card parity: seeding the six cards with fees (in cents) 9500, 89500, 55000, 15000, 49500, 65000 → `cards` has exactly 6 entries, fee total = 253500 (doc §1.5), each card's `currency_id` references a seeded currency.
3. Benefit parity: every doc §5 row appears exactly once per card section (§5.1–5.6) with the doc's amount and anchor; test pins per-card row counts and spot-checks at least the CSP hotel credit (10000, anniversary, confirmed), Aspire resort credit (20000, half_year), Brilliant dining credit (2500, month), and Surpass threshold row (1500000, spend_threshold).
4. Verify flags: every row the doc marks *Verify* (e.g. Resy, digital entertainment, lululemon, Uber Cash, Oura, Walmart+, CLEAR+ amounts, CSP "other perks") → `verification: "verify"` with the doc's note; doc-*Confirmed* rows → `"confirmed"`. Test count of verify-flagged rows matches the doc.
5. Retired handling: Saks row has `status: "retired"` and `effective_to` set → it appears in `allBenefits` but NOT in `activeBenefits`.
6. Currencies: exactly five currencies (MR, UR, Hilton, Marriott, Bilt) with positive cents-per-point defaults; cards referencing them resolve.
7. Every benefit has a non-empty `source_url` and `last_verified_at` date — enforced by the schema and asserted in a test.
8. Threshold rows carry `threshold_cents`: Aspire 3000000 & 6000000, Surpass 1500000 & 4000000 (and temporary Diamond), Brilliant 6000000; Global Entry rows are `multi_year` with `interval_years: 4`.

## Edge cases
1. A benefit row with `amount_cents: -1` or a non-integer must fail validation; 0 or null (non-monetary benefit) must pass.
2. `effective_from` after `effective_to` must be rejected by a refinement, so the Saks retirement window and the CSP 2026-06-15 change can't be inverted.
3. Retired benefit must remain queryable (history) while excluded from forward-ROI helpers — `activeBenefits` filters on `status`, not existence.
4. `multi_year` without `interval_years`, and `spend_threshold` without `threshold_cents` → schema failure (discriminated union or superRefine).
5. Money rounding: all amounts parse as integer cents; no seeded value is expressed in dollars as a float (test asserts integer type and spot totals, e.g. 2×30000 = 60000 for Amex hotel credit).
6. Unknown `currency_id` on a card, or duplicate benefit/card ids → schema or seed test failure.
7. A *Verify* row missing its note (the doc's caveat) must fail — the flag is meaningless without the reason.
8. `enrollment_required` must be `true` where the doc says "Enrollment required" (Resy, digital entertainment, lululemon, Equinox, Uber Cash, Oura, Walmart+, Priority Pass rows, National car rows) — assert in tests.
