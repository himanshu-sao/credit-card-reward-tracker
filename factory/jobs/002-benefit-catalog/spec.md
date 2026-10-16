# Spec — 002-benefit-catalog

## Goal

Make `packages/catalog` the versioned domain contract for the tracker: Zod schemas plus inferred TypeScript types for `Card`, `Currency`, and `Benefit` (all doc §6 fields, integer-cents money, discriminated reset anchors, verification flags), seeded with the six launch cards, every benefit row from doc §5, and the five point currencies from §3.6. Downstream jobs (reset engine, ROI, API, web) consume only these exports. Out of scope: reset-engine period generation, ROI math, API/database, web UI, user valuation overrides.

## Approach

All code lives under `packages/catalog/src/`; delete the placeholder `CatalogEntry` from `packages/shared` (or wherever it currently sits) and its smoke test.

Files (every file named):

- `packages/catalog/src/currency.ts` — `CurrencySchema` / `Currency`: `id`, program `name`, positive `default_cents_per_point` (integer).
- `packages/catalog/src/card.ts` — `CardSchema` / `Card`: `id`, `issuer`, `name`, integer `fee_cents`, `network`, `currency_id`.
- `packages/catalog/src/benefit.ts` — `BenefitSchema` / `Benefit` with exactly the §6 fields: `id`, `card_id`, `name`, `category`, nullable integer `amount_cents` (≥ 0, non-monetary rows use `value_descriptor` instead), `value_descriptor` (string), `cadence`, `reset_anchor`, `rules` (text: eligible merchants, minimums, portal requirement), `enrollment_required` (boolean), `status` enum `active | changed | retired | grandfathered`, `effective_from` / `effective_to` (dates, refinement rejects `from > to`), `source_url` (issuer's official card page URL, one per card), `last_verified_at` (2026-10-15 on every row), `verification` enum `confirmed | verify`, and a required `note` whenever `verification === "verify"` (superRefine).
- `packages/catalog/src/benefit.ts` also defines the reset anchor as a discriminated union: `calendar_year | half_year | quarter | month | anniversary | renewal | ongoing | per_stay | per_purchase | per_booking` carry no extra data; `multi_year` requires integer `interval_years` (Global Entry = 4); `spend_threshold` requires integer `threshold_cents`.
- `packages/catalog/src/cards.ts` — the six seed cards (doc §1.5): fee_cents 9500, 89500, 55000, 15000, 49500, 65000 (total 253500).
- `packages/catalog/src/currencies.ts` — the five seed currencies (doc §3.6): MR, UR, Hilton Honors, Marriott Bonvoy, Bilt Points.
- `packages/catalog/src/benefits.ts` — every doc §5 benefit row per card, per the seed-data manifest below.
- `packages/catalog/src/index.ts` — re-exports schemas/types, the seed arrays, and typed helpers `cards`, `currencies`, `allBenefits`, and `activeBenefits` (filters out `status: "retired"`, so retired Saks appears in the first three lists but not the last).
- `packages/catalog/test/*.test.ts` — Vitest unit tests per the acceptance criteria; remove the placeholder smoke test.
- `packages/catalog/package.json` — dependencies: `zod` (already present) and `@ccrt/shared` workspace dep; no new deps.

Confirmed seed decisions (verbatim from the refined prompt):

1. `source_url` is the issuer's official card page URL — one per card, not per benefit — with `last_verified_at` = 2026-10-15 on every row.
2. Rows with no stated date get `effective_from` = 2026-10-01 and `effective_to` = null; explicit dates in the doc stay as-is (CSP hotel credit 2026-06-15; Saks retirement 2026-07).
3. The Amex Platinum flights/prepaid-hotels earning row carries no structured cap field — the doc's "annual cap per sources" wording goes in its note.
4. CLEAR+ is `amount_cents` = 20900 with the $189–$219 range recorded in the note.

## Acceptance criteria

Each criterion is provable with pasted test output (`pnpm -r test`); build.md must paste it.

1. **Schema strictness** — `safeParse` fails for a benefit row with: invalid `status`/`cadence`/`reset_anchor` enum value, missing `source_url`, negative `amount_cents`, malformed `effective_from`, or a `multi_year` anchor missing `interval_years` (same for `spend_threshold` missing `threshold_cents`); every seeded row parses cleanly.
2. **Card parity** — exactly 6 cards; `fee_cents` 9500, 89500, 55000, 15000, 49500, 65000; total = 253500 (doc §1.5); every card's `currency_id` resolves to a seeded currency.
3. **Benefit parity** — per-card row counts match doc §5.1–5.6 exactly (see manifest); spot-checks pinned in tests: CSP hotel credit (10000, anniversary, confirmed), Aspire resort credit (20000, half_year), Brilliant dining credit (2500, month), Surpass threshold row (1500000, spend_threshold), CLEAR+ (20900 with "$189–$219" in its note).
4. **Verify flags** — every doc-*Verify* row (Resy, digital entertainment, lululemon, Uber Cash, Oura, Walmart+, CLEAR+ amounts, CSP "other perks", …) has `verification: "verify"` with the doc's note verbatim; doc-*Confirmed* rows have `"confirmed"`; the count of verify-flagged rows equals the doc's count (assert exact number from the manifest).
5. **Retired handling** — Saks row: `status: "retired"`, `effective_to` = 2026-07; present in `allBenefits`, absent from `activeBenefits`.
6. **Currencies** — exactly five (MR, UR, Hilton Honors, Marriott Bonvoy, Bilt Points), each with positive integer `default_cents_per_point`; card `currency_id`s resolve.
7. **Source provenance** — every benefit has non-empty `source_url` (one issuer-official card page URL per card) and `last_verified_at` = 2026-10-15; schema-enforced and asserted in a test.
8. **Threshold/multi_year fields** — Aspire 3000000 & 6000000; Surpass 1500000 & 4000000 (and temporary Diamond threshold); Brilliant 6000000; Global Entry rows `multi_year` with `interval_years: 4`.

Green gates: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` all pass.

## Edge cases

Each maps to a concrete unit test in `packages/catalog/test/`:

1. `amount_cents: -1` and non-integer `amount_cents` fail validation; `0` and `null` pass (non-monetary benefit).
2. `effective_from` after `effective_to` rejected by a refinement (guards Saks retirement window and CSP 2026-06-15 change from inversion).
3. Retired benefit stays queryable (history) but is excluded from `activeBenefits` — helper filters on `status`, not existence.
4. `multi_year` without `interval_years` and `spend_threshold` without `threshold_cents` → schema failure (discriminated union).
5. Money rounding: all seeded amounts are integer cents; no dollar floats; spot totals asserted (e.g. Amex hotel credit 2 × 30000 = 60000).
6. Unknown `currency_id` on a card, or duplicate benefit/card ids → schema or seed test failure.
7. A `verify` row missing its `note` fails validation — the flag is meaningless without the reason.
8. `enrollment_required: true` where the doc says "Enrollment required": Resy, digital entertainment, lululemon, Equinox, Uber Cash, Oura, Walmart+, Priority Pass rows, National car rows — asserted in tests.
9. Undated rows get `effective_from` = 2026-10-01, `effective_to` = null; only CSP hotel credit (2026-06-15) and Saks (2026-07) carry explicit doc dates — asserted in tests.

## Seed-data manifest

Every doc §5 row, one line each: name | reset_anchor | amount_cents or value_descriptor | status | verification.
All rows: `source_url` = issuer's official card page URL (per card); `last_verified_at` = 2026-10-15;
undated rows get `effective_from` = 2026-10-01, `effective_to` = null. Verify count per card: CSP 3, Amex Plat 10, Aspire 3, Surpass 2, Bilt 1, Brilliant 3 → 22 total.

**5.1 Chase Sapphire Preferred** — 6 rows, fee 9500, currency UR.

| Benefit | Anchor | Amount / descriptor | Status | Verification |
|---|---|---|---|---|
| Chase Travel hotel credit | anniversary | 10000 | active | confirmed (`effective_from` = 2026-06-15) |
| Global Entry / TSA PreCheck / NEXUS credit | multi_year, interval_years 4 | 12000 | active | verify |
| Points Boost | per_booking | value_descriptor: "Up to 1.5x redemption value" | active | confirmed |
| Earning | ongoing | value_descriptor: "5x Chase Travel, 3x dining/streaming; added categories reported" | active | verify |
| Hyatt transfer | ongoing | value_descriptor: "4:3 ratio, from 2026-10-01" | active | confirmed |
| Other perks (streaming/subscription offers) | ongoing | value_descriptor: "Varies" | active | verify |

**5.2 The Platinum Card from American Express** — 15 rows, fee 89500, currency MR.

| Benefit | Anchor | Amount / descriptor | Status | Verification |
|---|---|---|---|---|
| Hotel credit | half_year (two $300 tranches/yr; multiplicity in note) | 30000 | active | confirmed |
| Resy dining credit | quarter (per note: cadence unconfirmed) | 40000 | active | verify; enrollment_required true |
| Digital entertainment credit | month (per note: cadence unconfirmed) | 30000 | active | verify; enrollment_required true |
| lululemon credit | quarter (per note: cadence unconfirmed) | 30000 | active | verify; enrollment_required true |
| Equinox credit | month (per note: cadence unconfirmed) | 30000 | active | verify; enrollment_required true |
| CLEAR+ credit | calendar_year | 20900; note carries "$189–$219" range | active | verify (amount) |
| Airline incidental fee credit | calendar_year (one selected airline) | 20000 | active | confirmed |
| Uber Cash | month + December bonus in note (cadence unconfirmed) | 20000 | active | verify; enrollment_required true |
| Uber One membership credit | calendar_year | 12000 | active | confirmed |
| Oura Ring credit | month (per note: cadence unconfirmed) | 20000 | active | verify; enrollment_required true |
| Walmart+ credit | month (per note: cadence unconfirmed) | 15500 | active | verify; enrollment_required true |
| Saks credit | none (non-resetting) | 10000 | **retired**, `effective_to` = 2026-07 | confirmed; excluded from activeBenefits/ROI |
| Flights / prepaid hotels earning | ongoing | value_descriptor: "5x via Amex Travel"; note: "annual cap per sources" (no structured cap field) | active | confirmed |
| Lounge access | ongoing | value_descriptor: "Centurion and other networks"; note: Lufthansa access ended 2026-10-01 | active | confirmed |
| Hotel status | ongoing | value_descriptor: "Complimentary hotel/car-rental elite status" | active | verify; enrollment_required true |
| Fine Hotels + Resorts perks | per_stay | value_descriptor: "Amex-cited average ~$550 per stay" | active | confirmed |

**5.3 Hilton Honors American Express Aspire** — 10 rows (doc's 9 table rows; "Additional free nights" split into two rows, one per threshold_cents), fee 55000, currency Hilton Honors.

| Benefit | Anchor | Amount / descriptor | Status | Verification |
|---|---|---|---|---|
| Hilton resort credit | half_year (two $200 tranches/yr; multiplicity in note) | 20000 | active | confirmed |
| Flight credit | quarter (four $50 tranches/yr; multiplicity in note) | 5000 | active | confirmed |
| CLEAR+ credit | calendar_year | 20900; note carries "$189–$219" range | active | verify (amount) |
| Free Night Reward | renewal (on approval, then each renewal — note both triggers) | value_descriptor: "1 night" | active | confirmed |
| Additional free nights (1 at $30k, 1 at $60k) | spend_threshold, threshold_cents 3000000 | value_descriptor: "1 free night" | active | confirmed |
| Additional free nights — second tier | spend_threshold, threshold_cents 6000000 | value_descriptor: "1 free night" | active | confirmed |
| Hilton Diamond status | ongoing | value_descriptor: "Status" | active | confirmed |
| National Car Rental Emerald Club Executive | ongoing | value_descriptor: "Status" | active | confirmed; enrollment_required true |
| Property credit (Conrad / Waldorf Astoria) | per_stay | 10000 | active | verify |
| Airport lounge access | ongoing | value_descriptor: "Priority Pass" | active | verify; enrollment_required true |

**5.4 Hilton Honors American Express Surpass** — 6 rows, fee 15000, currency Hilton Honors.

| Benefit | Anchor | Amount / descriptor | Status | Verification |
|---|---|---|---|---|
| Hilton statement credit | quarter (four $50 tranches/yr; multiplicity in note) | 5000 | active | confirmed |
| Free Night Reward | spend_threshold, threshold_cents 1500000 | value_descriptor: "1 night" | active | confirmed |
| Temporary Diamond status | spend_threshold, threshold_cents 4000000 | value_descriptor: "Status" | active | verify |
| Hilton Gold status | ongoing | value_descriptor: "Status (incl. fifth-night-free on point stays)" | active | confirmed |
| National Car Rental status | ongoing | value_descriptor: "Status" | active | verify; enrollment_required true |
| Earning | ongoing | value_descriptor: "12x Hilton, 6x U.S. dining/groceries/gas, 3x other" | active | confirmed |

**5.5 Bilt Palladium** — 7 rows, fee 49500, currency Bilt Points.

| Benefit | Anchor | Amount / descriptor | Status | Verification |
|---|---|---|---|---|
| Bilt Travel hotel credit | half_year (two $200 tranches/yr; multiplicity in note) | 20000 | active | confirmed |
| Bilt Cash | anniversary (annual expiry at calendar year-end noted) | 20000 | active | verify (expiry rule) |
| Priority Pass | ongoing | value_descriptor: "Member + 2 guests" | active | confirmed; enrollment_required true ("activation required") |
| Rent / mortgage rewards | month | value_descriptor: "Up to 1.25x" (tied to Bilt Cash/points choice, noted) | active | confirmed |
| Everyday earning | ongoing | value_descriptor: "2x points; option of 4% Bilt Cash" | active | confirmed |
| Neighborhood Benefits | per_purchase | value_descriptor: "Extra points at partner merchants" | active | confirmed |
| Protections | ongoing | value_descriptor: "World Legend Mastercard coverages" | active | confirmed |

**5.6 Marriott Bonvoy Brilliant American Express** — 9 rows, fee 65000, currency Marriott Bonvoy.

| Benefit | Anchor | Amount / descriptor | Status | Verification |
|---|---|---|---|---|
| Brilliant dining credit | month ($25 monthly, calendar-year overall) | 2500 | active | confirmed |
| Annual free night award | renewal | value_descriptor: "Up to 85K points (per sources)" | active | verify (certificate rules) |
| Marriott property credit | month (per note: cadence unconfirmed) | 10000 | active | verify |
| Elite Night Credits | calendar_year | 25 (non-monetary; value_descriptor "25 elite night credits", amount_cents null) | active | confirmed |
| Platinum Elite status | ongoing | value_descriptor: "Status" | active | confirmed |
| Global Entry / TSA PreCheck credit | multi_year, interval_years 4 (TSA interval disputed — in note) | 12000 (Global Entry); note: "up to 8500 TSA PreCheck" | active | verify |
| Priority Pass Select | ongoing | value_descriptor: "Unlimited visits" | active | confirmed; enrollment_required true |
| Brilliant Earned Choice Award | spend_threshold, threshold_cents 6000000 | value_descriptor: "Choice of benefit (Suite Night Awards / free night / mattress discount)" | active | confirmed |
| Earning | ongoing | value_descriptor: "6x Marriott properties" | active | confirmed |

**Doc §5 self-contradictions / judgement calls (recorded, not silently resolved):**

- "Additional free nights at $30,000 and $60,000" is one table row but needs two `threshold_cents` values — split into two seed rows.
- Brilliant dining credit: "$300 monthly ($25)" — $25 × 12 = $300; seeded as 2500 cents per month (refined prompt's confirmed spot-check).
- Saks row has "—" for cadence; seeded as non-resetting (no anchor variant) with `effective_to` = 2026-07.
- CLEAR+ listed as $189/$209/$219 across sources; refined prompt confirmed `amount_cents` = 20900 with range in note (both Amex Platinum and Aspire rows).
- Amex Platinum hotel credit "Amount confirmed; booking rules Verify" — seeded `verification: "verify"` per the doc's Verify marker, with the booking-rules caveat in the note.
- Equinox, Oura, and Marriott property credit rows have *Verify* cadence with no "commonly X" hint in the doc; the schema still requires a `reset_anchor`, so they are seeded with a best-guess anchor (month for Equinox/Oura per sibling credits; month for Marriott property credit) with the uncertainty recorded in the row's note — the `verify` flag is what carries the caveat forward.
- Saks row's Status column says "Retired" with no *Confirmed*/*Verify* marker; seeded `verification: "confirmed"` (its retirement date is documented fact) — flagged here so a reviewer can veto.
- Verify-count test target: 22 verify rows total (3 + 10 + 3 + 2 + 1 + 3); the Amex Platinum count of 10 includes the hotel credit row's "booking rules Verify" caveat.
