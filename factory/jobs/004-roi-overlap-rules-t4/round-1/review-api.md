VERDICT: PASS
- No HTTP surface (pure `packages/rules` change; persistence is Phase-2 per spec) — verified via `pnpm -C $TMPDIR/004-t4-build --filter @ccrt/rules test`: 12 files / 104 tests pass, registry.test.ts at 22 (12 t2 + 10 new t4).
- Independent spot matrix through `detectOverlaps` imported from `@ccrt/rules` root (8 checks, all pass): asOf−1y → GE warning with `['csp-global-entry','brilliant-global-entry']`; asOf−4y and asOf−4y−1d → no GE warning (boundary exact); asOf−3y → warning; future date → none; missing date → other static rules fire unchanged; no-GE-card wallet never fires (date present or absent); malformed dates (`2026-13-45`, `not-a-date`) rejected by `OverlapInputSchema` before reaching the rule.
- Regression check: t1/t2 tests untouched and passing (104 total = 94 prior + 10 new); `detectStaticOverlaps` still exported alongside `detectOverlaps`.
- Hygiene: `pnpm -r lint` and `prettier --check` clean on the diff; zero `new Date`/`Date(` occurrences in the branch diff (pure ISO-string math via `addYears`/`compareISO`).
- Scratch spot-check file removed after running; no commits made, server N/A.
