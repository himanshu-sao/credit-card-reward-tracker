STATUS: GREEN

# Job 004-t7 — ROI redundant-benefit marking (build)

Commit: `8408232` (`feat(rules): mark overlap-flagged benefits redundant in ROI
breakdown`) on branch `factory/004-roi-overlap-rules-t7`.

## What changed (3 files — index.ts needed no touch)

- `packages/rules/src/roi/input.ts` — `RoiInputSchema` gains an optional
  `overlap_warnings: z.array(OverlapWarningSchema).default([])` field
  (`OverlapWarningSchema` imported from `overlap/registry.js`; no import
  cycle — registry does not import from `roi/`). Every pre-t7 call site
  parses unchanged.
- `packages/rules/src/roi/compute.ts` — `BenefitRoiSchema` gains
  `redundant: z.boolean()`. `computeCardRoi` builds a `Set` of warned ids that
  exist in the card's input `benefits` (unknown ids dropped at runtime),
  flags matching breakdown rows, and pushes a zero-valued `redundant: true`
  row for a flagged benefit with no in-window instances (the
  `surpass-gold-status` `no_periods` case). Annotation only: the redundant
  set never touches face/used/net math.
- `packages/rules/src/roi/compute.test.ts` — t5's two exact-equality benefit
  fixtures updated with `redundant: false`; new `AC1`–`AC4` describes for t7
  using a Surpass-shaped fixture (status benefit + hotel credit) and the
  `hilton-diamond-redundant` warning shape from `detectOverlaps`.
- `packages/rules/src/index.ts` — unchanged: it re-exports
  `RoiInputSchema`/`RoiInput`, `BenefitRoiSchema`/`BenefitRoi`, and
  `CardRoiSchema`/`CardRoi` by reference, so the new field/flag is already
  exported. The spec allowed "only the type re-export may need touch" — none
  was needed. (4-file warning resolved to 3 touched files.)

No docs/README changes: no env vars, no user-facing surface, and doc §3.9
"show in ROI view" is the behavior implemented, not diverged from.

## Evidence per acceptance criterion

All commands run in the worktree; cert-trust noise lines removed from the
pasted output (a sandbox artifact, not test output).

**AC1 — Diamond warning flags the zero-valued status row; others false.**
Test `AC1 — Diamond warning flags the no-instances status benefit row`
asserts `flagged` equals exactly the zero-valued `surpass-gold-status` row and
the `surpass-hotel-credit` row is `redundant: false`.

**AC2 — annotation only, totals byte-identical.** Test compares
absent-field, `[]`, and warned runs across all four card totals
(`face_value_available_cents`, `value_used_cents`, `net_used_cents`,
`net_available_cents`).

**AC3 — unknown benefit ids ignored, output still parses.** Test drops
`surpass-gold-status` from the input benefits and passes the Diamond warning:
no crash, benefits identical to the no-warning baseline, and the result went
through `CardRoiSchema.parse` (a parse failure would fail the test).

**AC4 — two warnings, one flagged row.** Test passes two warnings both naming
`surpass-gold-status`, asserts exactly one such row and total length 2.

**AC5 — full suite green.** `pnpm -r test`:

```
packages/shared test:  Test Files  1 passed (1)
packages/shared test:       Tests  3 passed (3)
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  1 passed (1)
packages/catalog test:  Test Files  6 passed (6)
packages/catalog test:       Tests  47 passed (47)
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  21 passed (21)
packages/rules test:  Test Files  12 passed (12)
packages/rules test:       Tests  113 passed (113)
```

`pnpm --filter @ccrt/rules test` detail (compute.test.ts is the t5+t7 file —
all 11 t5 assertions still hold, now 15 tests):

```
 ✓ src/roi/compute.test.ts (15 tests) 7ms
 ✓ src/roi/input.test.ts (11 tests) 6ms
 ✓ src/overlap/registry.test.ts (27 tests) 5ms

 Test Files  12 passed (12)
      Tests  113 passed (113)
```

`pnpm -r lint` — no errors or warnings (all five lint scripts `Done`):

```
packages/shared lint: Done
apps/web lint: Done
packages/catalog lint: Done
apps/api lint: Done
packages/rules lint: Done
```

`pnpm -r format` — every file reported `(unchanged)` or wrote clean; final
post-commit run of all three (test/lint/format) green.

## Simplification passes

Pass 1 removed a duplicated 20-line input literal in the AC3 test and a
misleading variable name (`aspireOnly`). Pass 2 removed a double computation
of the AC3 baseline. Both passes re-ran tests (113 passed), lint, and format
clean before committing. Production diff is 31 lines across `compute.ts` +
`input.ts`; no speculative generality — the only added state is one `Set`.
