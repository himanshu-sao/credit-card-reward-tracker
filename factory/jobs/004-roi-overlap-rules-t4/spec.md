# Job 004-t4 — Time-aware Global Entry rule + detectOverlaps export (spec)

## SIZE WARNING

- Approach modifies **4 files** (limit 3): `packages/rules/src/overlap/registry.ts`,
  `registry.test.ts`, `packages/rules/src/index.ts`, and a **one-line doc-comment
  correction** in `overlap/input.ts` (its comment says a missing GE date "falls
  back to `asOf`" — contradicting the confirmed never-fires semantics). No code
  change in `input.ts`. Orchestrator may proceed; no decomposition needed.

## Goal

Add the sixth doc §3.9 overlap rule to `packages/rules`: `global-entry-overlap`,
the time-aware Global Entry rule decided in parent `answers.md` Q3. It fires iff
at least one GE card is held (`chase-sapphire-preferred` / `csp-global-entry` or
`marriott-bonvoy-brilliant` / `brilliant-global-entry`; Amex Platinum has no GE
row in the catalog) and a new GE application starting at `asOf` would begin
before the existing 4-year coverage from the caller-supplied
`last_ge_application_date` expires. Then export `detectOverlaps` from
`packages/rules/src/index.ts` — the single public entry point composing the t2
static registry plus this GE rule — completing the overlap API. Pure ISO-string
date math via `src/dates.ts` (existing `addYears`/`compareISO`); no `Date`
objects, no I/O, zod the only dependency.

## Approach

- `packages/rules/src/overlap/registry.ts` (extend) — add the GE rule next to
  `STATIC_RULES`. Coverage end = `addYears(last_ge_application_date, 4)`; warning
  iff `compareISO(coverageEnd, asOf) > 0` (strictly after — coverage expiring
  exactly at `asOf` is no overlap) and ≥ 1 GE card held; `benefit_ids` = held GE
  benefit ids. Add `detectOverlaps(input) → OverlapWarning[]` here: re-parse via
  `OverlapInputSchema`, then compose `detectStaticOverlaps` + the GE rule into
  one stable-order result. This is the composition point t3's Priority Pass /
  Hilton Diamond rules slot into — keep them out (parallel job); merging is
  additive here.
- `packages/rules/src/overlap/registry.test.ts` (extend) — mirror the t2 test
  style (`BASE` fixture, `valid()` helper, `asOf: '2026-06-01'`).
- `packages/rules/src/index.ts` — export `detectOverlaps` (+ warning types
  already exported; keep `detectStaticOverlaps` exported).
- `packages/rules/src/overlap/input.ts` — one-line doc-comment fix only:
  missing `last_ge_application_date` → the GE rule never fires (no fallback).
- Malformed dates never reach the rule: t1's `OverlapInputSchema` rejects them
  (assert via a type-level comment or a schema-level test). Out of scope:
  persistence of the date (Phase-2 API), ROI integration of warnings, t3 rules.

## Acceptance criteria

1. Six-card wallet, `last_ge_application_date = asOf − 1y`:
   `detectOverlaps` (imported from `@ccrt/rules` root) returns exactly six
   warnings, including GE with `benefit_ids` `['csp-global-entry',
   'brilliant-global-entry']` and `rule_id: 'global-entry-overlap'`.
2. Boundary semantics, CSP + Brilliant held, via `detectOverlaps`:
   `asOf − 4y` → no GE warning (coverage expires exactly at `asOf`);
   `asOf − 4y − 1d` → no GE warning; `asOf − 3y` → GE warning fires.
3. Missing `last_ge_application_date` with GE cards held → no GE warning, no
   crash, and the other rules fire exactly as before (diff t2 behavior).
4. Edges: future `last_ge_application_date` → no GE warning; no GE card held
   (date present or absent) → no GE warning; malformed date rejected upstream
   by `OverlapInputSchema` (asserted), never reaching the rule.
5. Green: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` all pass; existing
   t1/t2 tests untouched and still passing; no `Date` objects in the diff.
