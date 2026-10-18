STATUS: GREEN

# Sub-job 004-t1 — Overlap input contract (build)

Feature commit: `04a1d28` (branch `factory/004-roi-overlap-rules-t1`)

## What changed

- `packages/rules/src/overlap/input.ts` (new, 31 lines) — `OverlapInputSchema`:
  `wallet: z.array(z.string().min(1))`, `asOf` (strict `YYYY-MM-DD` via the same
  `ISODate`/`isValidISO` refiner as `roi/input.ts`), optional
  `last_ge_application_date` (doc §3.9 GE rule). `.superRefine` rejects
  duplicate wallet ids (`duplicate card id <id>`). Doc comment records both
  decided semantics: unknown catalog ids pass the schema (t2's registry owns
  firing) and dates are strict `YYYY-MM-DD`.
- `packages/rules/src/overlap/input.test.ts` (new, 59 lines) — Vitest colocated;
  mirrors `roi/input.test.ts`'s `BASE` + `valid(over)` helper and
  `toThrow(/…/)` message assertions. 9 tests.
- `packages/rules/src/index.ts` — one new export line:
  `export { OverlapInputSchema, type OverlapInput } from './overlap/input.js';`
  Existing exports untouched.

## Acceptance criteria — evidence

### AC1 — valid inputs parse to a typed object

Tests: unique 2-id wallet + both dates, empty wallet, missing
`last_ge_application_date`, one-id wallet. All pass:

```
✓ src/overlap/input.test.ts (9 tests) 4ms
Test Files  10 passed (10)
Tests  71 passed (71)
```

### AC2 — duplicate card ids reject with the id named

Adjacent (`['csp','csp']`) and non-adjacent
(`['csp','amex-brilliant','csp']`) cases both asserted with
`toThrow(/duplicate card id csp/)`; part of the 9 passing tests above.

### AC3 — malformed dates reject matching /ISO date/

Asserted for `asOf: '2026-13-45'`, `last_ge_application_date: '2026-13-45'`,
and time-component strings `'2026-07-31T00:00:00Z'` on both fields; part of
the 9 passing tests above.

### AC4 — unknown catalog card ids parse (decided behavior)

Test `passes unknown catalog card ids (t2 registry owns firing)` asserts
`wallet: ['ghost-card']` parses; stated in the schema's doc comment.

### AC5 — green across the monorepo; exports intact

`pnpm -r test` (offline full suite):

```
packages/shared test:  Test Files  1 passed (1)      Tests  1 passed (1)
apps/web test:         Test Files  1 passed (1)      Tests  1 passed (1)
packages/catalog test: Test Files  6 passed (6)     Tests  47 passed (47)
apps/api test:        Test Files  2 passed (2)      Tests  10 passed (10)
packages/rules test:  Test Files  10 passed (10)    Tests  71 passed (71)
```

`pnpm -r lint` — all five scoped packages: `eslint .` → `Done` (no errors).

`pnpm -r format` — Prettier across the workspace: both new files report
`src/overlap/input.ts 2ms (unchanged)` / `src/overlap/input.test.ts 3ms
(unchanged)` after write; no diffs produced.

Export check: `packages/rules/src/index.ts` ends with

```
export { RoiInputSchema, instanceKey, type RoiInput } from './roi/input.js';
export { OverlapInputSchema, type OverlapInput } from './overlap/input.js';
```

Job-003 and roi exports unchanged (roi suite: `src/roi/input.test.ts (11
tests)` passing).

## Notes

- Diff: 3 files, ~90 new lines (well under the ~200 cap).
- Two-pass simplification done: removed an awkward destructuring in the
  missing-GE-date test; re-read both files for dead abstraction/verbosity —
  nothing further found. Tests/lint/format re-run clean after.
- `factory/board.json` had a pre-existing uncommitted change on the parent
  branch (orchestrator newline artifact); stashed to allow branch checkout and
  not included in this commit. `factory/jobs/004-roi-overlap-rules-t5/` is an
  unrelated untracked folder from the orchestrator; not committed here.
- At one point my `index.ts` export line disappeared from disk between steps
  (external process); re-added and re-verified before commit.
- This worktree is shared with other concurrent builder agents: a commit was
  briefly made on `factory/004-roi-overlap-rules-t5` after an external
  branch switch; moved to this branch (`git branch -f`), t5 restored to its
  original tip `d22dcbd`. No other branch content was modified. The t5
  agent's untracked files (`packages/rules/src/roi/compute.*`,
  `factory/jobs/004-roi-overlap-rules-t5/`) are present in the worktree but
  not part of this job's commits.
