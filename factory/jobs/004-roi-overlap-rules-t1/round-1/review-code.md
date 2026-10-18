VERDICT: PASS

- All 5 ACs verified by re-running, not by trusting build.md: `pnpm -r test` green (5 packages, rules 10 files / 71 tests incl. the 9 new `src/overlap/input.test.ts`), `pnpm -r lint` clean, `pnpm -r format` produces no diffs — matching build.md's pasted evidence.
- AC1–AC4 hold in code: `packages/rules/src/overlap/input.ts` reuses the identical `ISODate`/`isValidISO` refiner as `roi/input.ts` (so strict `YYYY-MM-DD`, time components reject), empty/one-id wallets parse, `last_ge_application_date` optional, and `.superRefine` names the duplicate id; both adjacent and non-adjacent duplicate cases and the unknown-id-passes case are asserted in tests. Decided semantics match `factory/jobs/004-roi-overlap-rules/answers.md` answer 3.
- Style matches the surrounding module: same doc-comment register, same `ISODate` const, same `fail`-style issue shape as `roi/input.ts`; test file mirrors `roi/input.test.ts`'s `BASE` + `valid(over)` helper. No bloat — 31-line schema, no dead abstraction or speculative generality.
- `packages/rules/src/index.ts` adds exactly one export line (`OverlapInputSchema`, `type OverlapInput`); roi and job-003 exports untouched.
- Not user-facing (internal package contract consumed by t2–t4), so no README/feature-doc update is owed.
