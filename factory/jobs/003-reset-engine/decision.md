APPROVE

## Rationale

- Spec acceptance criteria are satisfied: I spot-checked the correctness-critical core myself — `generateBenefitInstances` Zod-validates all input before any generation (`src/generate.ts`), `buildInstances` implements the confirmed rules (inclusive period_end, `period_start <= as_of` inclusion, retired = history only via the effective_to break, `prorated` flag with full amount, 600-instance guard at loop top) in `src/anchors/shared.ts`, Feb-29 clamps to Feb-28 in `addYears` (`src/dates.ts`), and all 13 anchors dispatch with explicit `no_periods` reasons for the 6 non-periodic ones.
- The build matches the feature doc where they overlap (§5.3 renewal "on approval", §7 anniversary-vs-calendar anchors, retired history preserved, mid-year flag-not-prorate — the confirmed reading of §7's "prorated or flagged").
- All three round-1 reviews are PASS, and their verifiable claims held up under my spot-check (the security reviewer's input-validation and guard claims match the source exactly).
- The AC4 note in the code reviewer's PASS report is a prose miscount, not a build defect: with `interval_years: 3`, open 2026-10-01, asOf 2029-12-31, the test correctly asserts 2 instances (2026-10-01→2029-09-30, then 2029-10-01→2032-09-30) because the spec's own confirmed inclusion rule (`period_start <= as_of`) starts the second period at 2029-10-01. The builder and test agree with each other and with the user-confirmed semantics; the reviewer verified the engine follows the rule but miscounted. It does not change my confidence in the round.
- Both deviations documented in build.md (AC4 count slip; spread-copy `effective_from` overrides in tests, never editing seed data) are reasonable and disclosed.

## Merge preconditions verified (by me, on the branch)

- `pnpm -r test`: green — 110/110 (shared 1, api 10, web 1, catalog 47, rules 51).
- `pnpm -r lint`: exit 0, no warnings.
- `pnpm -r format:check`: exit 0, all workspaces.
- `git diff main...factory/003-reset-engine --stat`: 3 commits, all changes in `packages/rules/` plus `package.json`/`pnpm-lock.yaml` workspace-dep wiring; repo-root README untouched (profile docs-sync policy satisfied — no user-facing divergence from the feature doc).

## Follow-up notes for the backlog

- The catalog `every_4_years` cadence-label fix (mislabels `multi_year` with `interval_years !== 4`) remains on the existing job-002 follow-ups item — intentionally out of scope here per the user's confirmed answer 4.
- Review discipline note: reviewers should paste the actual asserted values for count-based ACs (the round-1 code reviewer's AC4 bullet stated "exactly 1 instance" while the test asserts 2); worth a line in the review-policy strictness notes so future PASS reports are copy-exact.
