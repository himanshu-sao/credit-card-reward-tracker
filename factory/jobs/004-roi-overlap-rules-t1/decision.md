APPROVE

- **Tests re-run by me, green**: `pnpm -r test` → 154 passed, 0 failed across 5
  packages (rules 11 files / 82 tests including the 9 new
  `src/overlap/input.test.ts`; api 21, catalog 47, web 1, shared 3) — the
  post-merge (c67f2cf) numbers, not the builder's pre-merge claim.
  `pnpm -r lint` → exit 0 on all five scoped packages.
- **Diff is exactly the spec's scope**: `git diff main...HEAD -- packages/`
  is 3 files, +91 lines — `overlap/input.ts` (31-line Zod schema + doc
  comment), its colocated 9-test file, and one export line in
  `packages/rules/src/index.ts`. roi/job-003 exports untouched.
- **All 5 acceptance criteria verified in code, not just trusted from
  reviews**: valid 2-id/empty/one-id/missing-GE-date wallets parse;
  duplicate ids reject with the id named (adjacent + non-adjacent tests);
  `2026-13-45` and `2026-07-31T00:00:00Z` reject with `/ISO date/` on both
  fields (same `isValidISO` refiner as `roi/input.ts`); unknown catalog ids
  pass with the decided semantics stated in the doc comment.
- **Matches the product source of truth and parent decision**: doc §3.9 GE
  rule (CSP + Brilliant application-fee credits, 4-year window) and
  `factory/jobs/004-roi-overlap-rules/answers.md` answer 3 (time-aware,
  caller-supplied `last_ge_application_date` in the overlap input contract).
- **PASS verdicts spot-checked and deserved**: all three round-1 reviews
  verified by re-running rather than trusting build.md (the api reviewer even
  ran an independent 21-case matrix); my own read of the schema and tests
  agrees with their findings. Not user-facing, so no README/feature-doc sync
  is owed; no new env vars, deps, or secrets in the diff.
- build.md notes concurrent-worktree incidents (a briefly moved commit,
  restored per its account) — final branch state is verified correct by the
  diff-vs-main and green suite above; nothing to escalate on.
