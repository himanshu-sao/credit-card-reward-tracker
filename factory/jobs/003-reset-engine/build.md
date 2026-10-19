STATUS: GREEN

# Job 003: Reset engine (`packages/rules`) — build report

## What changed

Three commits on `factory/003-reset-engine` (branch off `main`):

1. `30150ad` — `feat(rules): date math, UserCardDates schema, and period result types`
2. `97eb5de` — `feat(rules): period generation for all 13 reset anchors`
3. `dd92641` — `refactor(rules): de-bloat pass over reset engine`

Files added/changed (all under `packages/rules/`, plus `package.json` +
`pnpm-lock.yaml` for the `@ccrt/catalog` workspace dep; repo-root README
untouched per spec):

- `src/dates.ts` — pure ISO-date (`YYYY-MM-DD`) math: parse/format/validate,
  compare, addMonths/addYears with end-of-month clamping (Feb 29 → Feb 28
  off-leap), quarter/half-year/month/year grid starts, dayBefore.
- `src/user-card-dates.ts` — the `UserCardDates` Zod schema this package owns
  (`open_date` required; `anniversary_date`/`fee_date` optional, each
  validated not-before `open_date`).
- `src/result.ts` — `BenefitInstanceSchema` (integer cents, `prorated: boolean`,
  `status` from catalog) and the discriminated `GenerateResultSchema`
  (`periods` | `no_periods`).
- `src/anchors/shared.ts` — `buildInstances`: the single shared core applying
  effective_from/effective_to gating, retired = history only, mid-period
  opening (`prorated: true`, full amount, never scaled), and the 600-instance
  guard.
- `src/anchors/calendar.ts` — month/quarter/half_year/calendar_year grid
  periods.
- `src/anchors/anniversary.ts` — anniversary-to-anniversary periods with
  re-set `anniversary_date` support and leap-day clamping.
- `src/anchors/renewal.ts` — immediate instance at `open_date` (doc §5.3 "on
  approval") then fee-date-anchored cycles; fallback chain
  `fee_date → anniversary_date → open_date`.
- `src/anchors/multi-year.ts` — generic `interval_years` periods.
- `src/generate.ts` — `generateBenefitInstances`: Zod-validates input (bad
  dates, missing `open_date`, `asOf < open_date` all throw ZodError before any
  generation), dispatches the 7 period anchors, returns explicit
  `no_periods` reasons for the 6 non-period anchors.
- `src/index.ts` — public exports (`generateBenefitInstances`, schemas, types;
  `RULES_ENGINE_NAME` kept).
- `src/test-benefit.ts` — test fixtures: `seedBenefit` lookup +
  `syntheticBenefit` builder.
- Tests next to sources: `dates.test.ts`, `user-card-dates.test.ts`,
  `smoke.test.ts`, `generate.test.ts`, `anchors/{calendar,anniversary,
  renewal,multi-year}.test.ts` — 51 tests, every test commented with its
  doc §7 edge case or refined-prompt goal number.

## How tested — pasted evidence

### `pnpm -r test` (full repo)

```
packages/shared test:  Test Files  1 passed (1)
packages/shared test:       Tests  1 passed (1)
apps/api test:  Test Files  2 passed (2)
apps/api test:       Tests  10 passed (10)
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  1 passed (1)
packages/catalog test:  Test Files  6 passed (6)
packages/catalog test:       Tests  47 passed (47)
packages/rules test:  Test Files  8 passed (8)
packages/rules test:       Tests  51 passed (51)
```

### `pnpm -r lint`

```
apps/api lint: Done
apps/catalog lint: Done
apps/web lint: Done
packages/rules lint: Done
```
(eslint exited clean in every workspace; no warnings or errors.)

### `pnpm -r format:check`

```
apps/api format:check: All matched files use Prettier code style!
packages/catalog format:check: All matched files use Prettier code style!
packages/rules format:check: All matched files use Prettier code style!
```
(exit 0 across all packages)

## Acceptance criteria — each with its evidence

All AC checks run via `pnpm --filter @ccrt/rules test`; the verbose reporter
lines below are pasted from that run.

1. **CSP anniversary (AC1)** —
   `✓ src/anchors/anniversary.test.ts > anniversary anchor > CSP hotel credit: exactly two periods, second current at as_of`
   (the test asserts
   exactly the two instances 2026-03-10→2027-03-09 and 2027-03-10→2028-03-09,
   second current at `asOf: 2027-03-10`).
2. **Mid-year monthly, flag-only (AC2)** —
   `✓ src/anchors/calendar.test.ts > calendar anchors > month: mid-month open keeps full amount with prorated flag`
   (Amex digital entertainment, open 2026-03-10, asOf 2026-03-31 → one
   instance 2026-03-01→2026-03-31, `amount_available_cents: 30000` (full),
   `prorated: true`).
3. **Half-year boundary (AC3)** —
   `✓ … half_year: as_of on Jul 1 makes the Jul–Dec period current`,
   `✓ … half_year: as_of on Jan 1 starts the Jan–Jun period`,
   `✓ … quarter: as_of on each quarter boundary starts the new quarter`.
4. **Multi-year generic (AC4)** —
   `✓ src/anchors/multi-year.test.ts > multi_year anchor > Global Entry: interval 4, exactly one 2026-10-01 to 2030-09-30 period`,
   `✓ … interval_years 3: first period ends 2029-09-30, next starts 2029-10-01`,
   `✓ … interval_years 1 degenerates to annual periods`,
   `✓ … interval_years 0 and negative are rejected by the input schema`
   (rejected by `ResetAnchorSchema.safeParse`, i.e. input Zod, not the engine).
5. **No-periods contract (AC5)** — six seed benefits, one per non-periodic
   anchor, each:
   `✓ src/generate.test.ts > no-periods contract > amex-platinum-saks-credit returns no_periods with an anchor-specific reason`
   (same for `amex-platinum-lounge-access`, `aspire-property-credit`,
   `bilt-neighborhood-benefits`, `csp-points-boost`, `aspire-free-night-30k`)
   plus `✓ … spend_threshold reason documents threshold tracking` — reason
   is exactly "resets at a spend threshold — consumed by threshold tracking,
   not periods".
6. **Renewal (AC6)** —
   `✓ src/anchors/renewal.test.ts > renewal anchor > Aspire Free Night: immediate open_date instance, then fee_date cycle`
   (open 2026-06-15, fee_date 2027-05-01, asOf 2027-06-01 → exactly
   [2026-06-15→2027-04-30, 2027-05-01→2028-04-30]);
   `✓ … missing fee_date falls back to anniversary_date`;
   `✓ … missing fee_date and anniversary_date falls back to open_date`.
7. **Retired = history only (AC7)** —
   `✓ src/generate.test.ts > status and effective-date gating > retired monthly benefit stops at effective_to, past periods preserved`
   (periods start ≤ effective_to 2026-07-31 only, all `status: 'retired'`);
   `✓ … grandfathered status generates forward like active`;
   `✓ … changed status generates forward like active`;
   `✓ … effective_from after as_of yields an empty periods list` (kind
   `periods` with empty list — distinct from `no_periods`).
8. **Leap day (AC8)** —
   `✓ src/anchors/anniversary.test.ts > anniversary anchor > leap-day open 2024-02-29 clamps to Feb 28 in non-leap years`
   (deterministic bounds 2024-02-29→2025-02-27, 2025-02-28→2026-02-27,
   2026-02-28→2027-02-27);
   `✓ … re-set anniversary_date overrides open_date month/day`.
9. **Malformed input (AC9)** —
   `✓ src/generate.test.ts > malformed input > bad asOf date string throws ZodError`,
   `✓ … missing open_date throws ZodError`,
   `✓ … asOf before open_date is rejected`;
   `✓ src/user-card-dates.test.ts > UserCardDatesSchema > rejects missing open_date (refined-prompt goal 9)`,
   `✓ … rejects malformed or impossible dates (refined-prompt goal 9)`;
   non-monetary periods:
   `✓ src/anchors/multi-year.test.ts > … non-monetary multi_year benefit generates periods with null amount`
   (also covered for renewal via the Aspire Free Night's `amount: null`).
10. **600-period guard (AC10)** —
    `✓ src/generate.test.ts > 600-period guard > monthly anchor over a century throws the explicit guard error`
    (throws `/600-instance guard/`, not a hang or unbounded array).
11. **Boundaries (AC11)** —
    `✓ src/anchors/anniversary.test.ts > … as_of on period_start and period_end resolve per the safety margin`;
    `✓ … effective_from and effective_to boundaries keep the straddling period`
    (as_of on `effective_to` keeps the period starting on it);
    `✓ src/anchors/calendar.test.ts > … month: as_of on period_end keeps that period current`.
12. **Cross-anchor divergence (AC12)** —
    `✓ src/anchors/calendar.test.ts > … calendar_year: Jan 1 of a later year starts a new period`
    and `✓ src/anchors/anniversary.test.ts > … cross-year as_of stays inside the anniversary period`
    (at asOf 2027-01-15 the anniversary anchor yields exactly one period).
13. **Timezone convention documented (AC13)** — no tz runtime code anywhere;
    conventions in `src/generate.ts`, `src/anchors/shared.ts`, `src/dates.ts`,
    and `src/result.ts` header comments: inclusive period_end
    (23:59:59 local), `period_start <= as_of` inclusion, as_of on start →
    new period current, as_of on end → stays current (one-day safety margin).
14. **Purity and deps (AC14)** — `packages/rules/package.json` adds only the
    `@ccrt/catalog` workspace dep; runtime deps remain `zod` +
    workspace links. `grep -rn "fetch\|require('fs')\|http" src/` finds
    nothing; all functions are pure over strings.
15. **Repo green (AC15)** — test/lint/format:check outputs pasted above; the
    repo-root README is untouched (`git diff main...HEAD -- README.md` empty).

## Documented deviations from spec text

1. **AC4 `interval_years: 3` instance count.** Spec AC4 says "1 instance
   ending 2029-09-30", but under the spec's own confirmed rule (a period is
   generated when `period_start <= as_of`, and asOf is 2029-12-31) the
   2029-10-01 period also starts. The AC's count of 1 is an arithmetic slip;
   the first instance does end 2029-09-30 as stated. Documented in a comment
   on the test in `src/anchors/multi-year.test.ts` (kept; verified this
   round).
2. **Seed `effective_from` overrides in tests.** Several seed benefits carry
   `effective_from` values (e.g. 2026-04-01) that would gate the spec's
   worked examples. Tests widen them via spread-copy
   (`{ ...seedBenefit(id), effective_from: '2026-01-01' }`) — the catalog
   seed data is never edited. Convention now noted on `seedBenefit` in
   `src/test-benefit.ts` (added this round; the overrides themselves were
   already spread-copies).

## De-bloat pass (stage 3) — findings and actions

Ran twice over the full diff (`git diff main...HEAD`), per the profile.

- Round 1: removed dead exports `dayOfYear` and `endOfMonth` (used only by
  their own tests — speculative generality); removed the never-called
  `noPeriods` helper from `result.ts`; collapsed calendar.ts's two parallel
  key-maps (`GRID` + step) into one table; trimmed the now-dead assertions.
- Round 2: inlined `withInclusiveEnds` (single consumer) into a simpler
  `gridBounds` generator in calendar.ts and deleted it from shared.ts —
  this also removed the awkward "sentinel one past the end" protocol;
  added the spread-copy convention note to `seedBenefit`.
- Deliberately kept: the `GenerateResultSchema.parse` wrappers in
  `generate.ts` (cheap runtime assertion of the output contract in the
  correctness-critical core — defensible, not bloat).

After both passes: 51/51 tests, lint clean, format clean (evidence above).
Net effect of the de-bloat commit: 29 insertions, 75 deletions.

## Final state

- Branch: `factory/003-reset-engine` (3 commits; base `main`)
- Final commit: `dd92641` (`dd9264167db5164d769600570832132a8414c80a`)
- Green gate: `pnpm -r test` (110 tests repo-wide, incl. 51 in rules),
  `pnpm -r lint`, `pnpm -r format:check` — all pass.
