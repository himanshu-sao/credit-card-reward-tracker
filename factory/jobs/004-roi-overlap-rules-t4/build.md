# Job 004-roi-overlap-rules-t4 — build summary

STATUS: GREEN

## What changed

- `packages/rules/src/overlap/registry.ts` — added `GE_COVERAGE` (CSP +
  Brilliant; Amex Platinum has no GE catalog row), `geOverlaps()` (the
  time-aware `global-entry-overlap` rule), and the composed entry point
  `detectOverlaps()` (t2 static rules + GE). Pure ISO string math via
  `addYears`/`compareISO` from `src/dates.ts` — no `Date` objects.
- `packages/rules/src/index.ts` — exported `detectOverlaps` from the package
  root (public API complete; `detectStaticOverlaps` stays exported).
- `packages/rules/src/overlap/input.ts` — one-line doc-comment fix only:
  missing `last_ge_application_date` → the GE rule never fires (was wrongly
  "falls back to `asOf`"). No behavior change.
- `packages/rules/src/overlap/registry.test.ts` — extended with the
  `detectOverlaps — time-aware Global Entry rule (t4)` suite (10 new tests;
  the file went 12 → 22), mirroring the t2 style (`BASE`, `valid()`,
  `asOf: '2026-06-01'`). No existing test was modified or deleted.

Semantics implemented (user-confirmed parent Q3 + t4 spec): the rule fires
iff at least one GE card is held AND `last_ge_application_date` is present
AND `compareISO(last_ge_application_date, asOf) <= 0` (a future date is not
a completed application — refined-prompt edge 1) AND
`compareISO(addYears(last_ge_application_date, 4), asOf) > 0` (strictly
after; coverage expiring exactly at `asOf` never warns). `benefit_ids` lists
the held GE benefits in `GE_COVERAGE` order.

## Spec size note

The spec's SIZE WARNING (4 files vs limit 3) was pre-approved by the
orchestrator (input.ts is a one-line comment fix, no code change); the
commit touches exactly those 4 files.

## Parent AC5 six-warning caveat

t3 (Priority Pass + Hilton Diamond rules) is a parallel job, not yet merged
to main — this branch has only t2's 3 static rules. AC1's test therefore
asserts the full composition order on this branch (3 static + GE = 4
warnings); the two t3 rules slot into `detectOverlaps` additively (the spec
explicitly reserves that composition point), giving the parent's six total
once t3 merges. The test comment records this so the merge doesn't look
like a regression.

## Acceptance criteria — evidence

All evidence from real runs in the isolated worktree (vitest 3.2.7), after
the two-pass simplification and final lint/format.

**AC1 — six-card wallet, date = asOf − 1y → warnings include GE on both ids,
via `detectOverlaps` from the package root.**

Test `six-card wallet, date = asOf − 1y → static rules + GE on both GE
benefit ids` asserts `rule_id: 'global-entry-overlap'` with `benefit_ids
['csp-global-entry', 'brilliant-global-entry']`, and the root export is
asserted by `is the same function exported from the package root`
(`expect(detectOverlapsFromRoot).toBe(detectOverlaps)`). Real output:

```
 ✓ src/overlap/registry.test.ts (22 tests) 5ms
 Test Files  12 passed (12)
      Tests  104 passed (104)
```

**AC2 — boundary semantics (CSP + Brilliant held, via `detectOverlaps`).**

`asOf − 4y` (`2022-06-01`): no GE warning; `asOf − 4y − 1d` (`2022-05-31`):
no GE warning; `asOf − 3y` (`2023-06-01`): GE warning fires with both ids.
Three dedicated tests, all in the passing 22 above.

**AC3 — missing date with GE cards held → no GE warning, no crash, other
rules unchanged.**

Test `missing date with GE cards held` asserts `geRule(...) === undefined`,
`detectOverlaps(...) toEqual detectStaticOverlaps(...)` (diff t2 behavior),
and the exact static warning list. Passing (in the 22 above).

**AC4 — edges.**

Future date (`2027-06-01`) → no GE warning; no GE card held, date present or
absent → no GE warning; malformed date (`2026-13-45`) → rejected by
`OverlapInputSchema` with `/ISO date/` before reaching the rule. All passing
(in the 22 above).

**AC5 — green: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` clean; t1/t2
tests untouched and passing; no `Date` objects in the diff.**

`pnpm -r test` (full monorepo):

```
packages/shared test:  Test Files  1 passed (1)    Tests  3 passed (3)
apps/web test:        Test Files  1 passed (1)    Tests  1 passed (1)
packages/catalog test: Test Files  6 passed (6)   Tests  47 passed (47)
packages/rules test:   Test Files  12 passed (12) Tests  104 passed (104)
apps/api test:         Test Files  3 passed (3)   Tests  21 passed (21)
```

176 total, 0 failures (registry file 12 → 22 tests; rules suite 94 → 104;
monorepo 166 at the t2 merge → 176 — exactly the 10 new tests).
`pnpm -r lint`: exit 0, no error/warn lines (`packages/rules lint: Done`).
`pnpm -r format`: all files unchanged (`prettier --write .` → `Done`).
`git diff | grep "new Date\|Date("` → no matches.

## Files in the commit

- packages/rules/src/overlap/registry.ts (extend: GE rule + detectOverlaps)
- packages/rules/src/overlap/registry.test.ts (extend: 10 t4 tests)
- packages/rules/src/index.ts (export detectOverlaps)
- packages/rules/src/overlap/input.ts (doc-comment fix, 1 line)

## Commit

- `4ae2744` — `feat(rules): time-aware Global Entry overlap rule +
  detectOverlaps entry point` on branch `factory/004-roi-overlap-rules-t4`
