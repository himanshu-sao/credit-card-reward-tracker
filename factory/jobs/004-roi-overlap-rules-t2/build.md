STATUS: GREEN

# Job 004-t2 build — overlap rule registry + 3 static rules

Commit: `502be90` on `factory/004-roi-overlap-rules-t2` (worktree
`$TMPDIR/004-t2-build`). Diff: 3 files, +209 lines — within the ≤3
files / ~200 lines budget.

## What changed

- `packages/rules/src/overlap/registry.ts` (new) — `OverlapWarningSchema`
  (`{ rule_id, message, benefit_ids }`, Zod) + `OverlapWarning` type, a
  `STATIC_RULES` registry (plain entries: `rule_id`, `message`,
  `cards: {card_id, benefit_id}[]`), and `detectStaticOverlaps(input)`:
  re-parses via the t1 `OverlapInputSchema`, then a rule fires iff
  ≥ 2 of its cards are held; `benefit_ids` are the held cards' benefit
  ids in registry order. Three entries (doc §3.9, ids read from the
  catalog seed files):
  - `clear-plus-reimbursement` — `amex-platinum`/`amex-platinum-clear-plus`
    (hyphenated, per seed) + `hilton-amex-aspire`/`aspire-clear-plus`
  - `airline-credit-rules-differ` —
    `amex-platinum-airline-incidental-credit` + `aspire-flight-credit`
  - `hotel-credit-no-stack` — `csp-hotel-credit` +
    `amex-platinum-hotel-credit` + `bilt-hotel-credit` (≥ 2 of 3 fires)
  - GE (t4) and Priority Pass / Hilton Diamond (t3) fenced out; registry
    shape (plain entries + uniform firing rule) lets t4's date-aware rule
    join without reworking the runner.
- `packages/rules/src/overlap/registry.test.ts` (new, 12 Vitest tests,
  colocated) — BASE + `valid(over)` fixture style from `input.test.ts`.
- `packages/rules/src/index.ts` — added `detectStaticOverlaps`,
  `OverlapWarningSchema`, `type OverlapWarning` next to the existing
  overlap export line; all other exports untouched.

Spec naming note: the spec (`spec.md`, authoritative) says
`registry.ts`/`detectStaticOverlaps`; the refined prompt's
`rules.ts`/`detectOverlaps`/`clear-plus-overlap` names are superseded by
the spec's AC-verbatim rule ids (`clear-plus-reimbursement`,
`airline-credit-rules-differ`, `hotel-credit-no-stack`), asserted in
tests.

## Evidence — acceptance criteria

All commands run in the worktree; cert-trust ERROR lines are macOS
sandbox noise from pnpm, filtered out.

### AC1 + AC2 + AC3 (rule behavior) — verbose registry test run

`npx vitest run src/overlap/registry.test.ts --reporter=verbose` (in
`packages/rules`):

```
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > CLEAR+ rule fires for [amex-platinum, hilton-amex-aspire] with seeded benefit ids 2ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > dropping either CLEAR+ card kills the CLEAR+ warning 1ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > airline rule needs both cards — Aspire alone yields no warning 0ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > hotel rule fires on any 2 of its 3 cards 0ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > hotel rule lists all three benefit ids when all three cards are held 0ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > wallet [hilton-amex-aspire, amex-platinum] yields exactly CLEAR+ and airline warnings 0ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > returns [] for an empty wallet without throwing 0ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > returns [] for unknown card ids (schema passes them; registry ignores them) 0ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > returns [] when fewer than 2 of any rule's cards are held 0ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > emits warnings that all validate through OverlapWarningSchema 1ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > ignores GE dates entirely (a missing GE date does not affect static rules) 0ms
 ✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > re-parses input with OverlapInputSchema — duplicates reject before evaluation 0ms
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

- AC1: first two tests — full warning objects asserted with `toEqual`,
  including `benefit_ids: ['amex-platinum-clear-plus', 'aspire-clear-plus']`.
- AC2: first + third tests.
- AC3: tests 4–6 (2-of-3 wallet, all-three wallet with all three
  benefit ids, Aspire+Platinum yields exactly CLEAR+ and airline — no
  hotel warning).

### AC4 (registry owns firing, never throws, schema round-trip)

Covered by the verbose block above: empty wallet → `[]`, `['ghost-card']`
→ `[]`, <2-held wallets → `[]`, every warning passes
`OverlapWarningSchema.parse`, `rule_id`s asserted verbatim as stable
strings via `toEqual` on full objects, and duplicates reject at
`OverlapInputSchema.parse` inside `detectStaticOverlaps`.

### AC5 (green suite + exports)

`pnpm -r test` (worktree):

```
packages/rules test:  Test Files  12 passed (12)
packages/rules test:        Tests  94 passed (21 → now 94 total; registry.test.ts adds 12)
apps/api test:  Test Files  3 passed (3)
apps/api test:        Tests  21 passed (21)
```

(94 = 82 pre-existing + 12 new; previously the branch base had 82 in
rules.)

`pnpm -r lint`: all five workspace projects lint clean (`packages/rules
lint: Done` etc., no eslint errors).

`pnpm -r format`: prettier reports all files unchanged after the final
run; `git status --short` shows only the three job files — no
formatting drift.

Exports: `packages/rules/src/index.ts` diff adds exactly the
`overlap/registry.js` export block (pasted in step-6 diff review);
`OverlapInputSchema`/`OverlapInput` line and all ROI/generate/result
export lines are byte-identical to main (verified via
`git diff main...HEAD -- packages/rules/src/index.ts` showing only the
5-line addition).

## Simplification pass (twice)

- Pass 1: removed an unnecessary wrapper — firing is a single
  `flatMap` with filter/map; no indirection kept. `StaticRule` kept
  only as the literal-array type annotation (no exported type beyond
  what the spec requires).
- Pass 2: re-read the full diff (`git diff main...HEAD` — 3 files,
  +209 lines); no dead abstractions, speculative hooks (t4 GE hook
  deliberately NOT pre-built, per spec), or over-commenting found.
  Tests re-run and lint/format re-run after both passes: still green.

## Notes / deviations

- The initial Write of `registry.ts` landed in a mistyped temp path
  (`/tmp/claude-504-t2-build/...`); it was copied into the worktree and
  the stray file is outside both repos (sandbox denies its deletion —
  harmless leftover in the OS temp dir, not in any git worktree).
- No env vars, no README/feature-doc changes needed: this is an
  internal package addition with no user-facing divergence from doc §3.9
  (rule ids and messages follow the doc's three warnings).
