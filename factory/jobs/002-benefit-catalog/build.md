STATUS: GREEN

# Build — 002-benefit-catalog

Branch `factory/002-benefit-catalog`, 23 commits (main..HEAD). All gates green:
`pnpm -r test` (60 tests, 11 files, 0 failures), `pnpm -r lint` (5/5 Done),
`pnpm format:check` (all clean). Two simplification passes run (commits
2f867dd, 6d98c98), gates re-run green after each.

## What changed

- `packages/catalog/src/`: `currency.ts`, `card.ts`, `benefit.ts` (Zod schemas;
  Benefit with all doc §6 fields, discriminated reset-anchor union, verify-
  requires-note + date-order superRefine, integer cents), `currencies.ts`
  (5 programs), `cards.ts` (6 cards), six per-card seed files (54 rows total),
  `benefits.ts` (allBenefits + activeBenefits), rewritten `index.ts`.
  Placeholder `CatalogEntry`/`CATALOG_NAME` and `smoke.test.ts` deleted.
- `packages/catalog/test/`: six test files, 47 tests.
- Doc synced: §1.5 fee total corrected $2,535 → $2,835 (the old figure
  mis-summed the doc's own table; 95+895+550+150+495+650 = 2835).

## Spec deviations (recorded, reviewer attention)

1. **Amex Platinum = 16 rows, not 15.** The spec heading says "15 rows" but
   its own manifest table and doc §5.2 both list 16 benefit rows, and the
   verify count of 10 only works with 16. Seeded 16; parity test asserts 16.
2. **Fee total 283500, not 253500.** The spec/doc total contradicts their own
   fee table; the correct sum of the six fees is 283500. Asserted 283500 and
   corrected the doc.
3. **Saks `effective_from` = 2026-01-01** (retired 2026-07-31), since a
   retirement window cannot start after it ends; the default 2026-10-01
   would invert the window.
4. **`rules` defaults to ''** — some rows have no separate rules text beyond
   what enrollment_required/status already encode.
5. **`cadence` is derived from `reset_anchor`** (1:1 mapping in benefit.ts)
   instead of being hand-written 54 times; BenefitSchema.transform fills it.
6. `default_cents_per_point` = 1 for all five currencies (conservative
   baseline; doc §3.6 makes it user-configurable later).

## Acceptance criteria evidence

`pnpm -r test` output (final run):

```
packages/shared test:  Test Files  1 passed (1)  Tests  1 passed (1)
packages/rules test:   Test Files  1 passed (1)  Tests  1 passed (1)
packages/catalog test: Test Files  6 passed (6) Tests 47 passed (47)
apps/web test:         Test Files  1 passed (1)  Tests  1 passed (1)
apps/api test:         Test Files  2 passed (2)  Tests 10 passed (10)
```

`pnpm -r lint`: all five packages `Done` (exit 0).
`pnpm format:check`: "All matched files use Prettier code style!" across all
five packages (exit 0).

1. **Schema strictness** — `test/schema-strictness.test.ts` (13 tests):
   rejects invalid status/cadence/anchor enum, missing source_url, negative
   and non-integer amount_cents, malformed date, multi_year without
   interval_years, spend_threshold without threshold_cents, inverted window,
   verify-without-note; every seeded row parses (all seeds run through
   `BenefitSchema.array().parse`).
2. **Card parity** — `test/cards.test.ts`: exactly 6 cards, fees
   9500/15000/49500/55000/65000/89500, total 283500 (see deviation 2), all
   currency_ids resolve, unique ids.
3. **Benefit parity** — `test/benefits-parity.test.ts` (10 tests): row counts
   16/7/6/10/6/9 per card; spot-checks CSP hotel 10000/anniversary/confirmed,
   Aspire resort 20000/half_year, Brilliant dining 2500/month, Surpass
   1500000/spend_threshold, CLEAR+ 20900 with "$189–$219" in note.
4. **Verify flags** — `test/verification.test.ts`: exactly 22 verify rows,
   3/10/3/2/1/3 per card; all 22 doc-Verify ids flagged; every verify row has
   a note.
5. **Retired handling** — `test/benefits-parity.test.ts`: Saks retired,
   effective_to 2026-07-31, in allBenefits, absent from activeBenefits;
   edge-cases test asserts activeBenefits = allBenefits − 1.
6. **Currencies** — `test/cards.test.ts`: exactly the five §3.6 programs,
   positive integer cents-per-point; card ids resolve.
7. **Source provenance** — `test/provenance.test.ts`: https source_url on
   every row, exactly one issuer URL per card, last_verified_at 2026-10-15
   on all 54 rows.
8. **Threshold/multi_year fields** — `test/benefits-parity.test.ts`: Aspire
   3000000 & 6000000, Surpass 1500000 & 4000000, Brilliant 6000000; both
   Global Entry rows multi_year interval_years 4.

Edge cases 1–9: `test/edge-cases.test.ts` (10 tests) covers money
strictness, window inversion, retired queryability, discriminated-union
required fields, integer-cents spot totals (2×30000=60000), duplicate/unknown
id checks, verify-requires-note, enrollment_required rows (13 ids asserted
in verification.test.ts), and effective_from defaults (only CSP hotel credit
and Saks deviate).

## Commits

Core schemas 908b516^..cbed54d; seeds 908b516, 45936a3, a0495fe, 4866b6c,
b889904, 26ce1aa, d5d1bcf, a6f1e85; tests d404d5f..6fd2143; simplification
2f867dd, 6d98c98; doc fix ed03896.
