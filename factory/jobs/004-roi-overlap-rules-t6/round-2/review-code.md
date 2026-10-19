VERDICT: PASS

- Fix is minimal and correct: the 3-line `ownEntry` helper (compute.ts:58) is
  applied at exactly the three flagged sites — `valuations` (compute.ts:64),
  `points_amounts` (compute.ts:80), `cents_per_point` (compute.ts:84) — and
  changes nothing for own keys (row 3 pins `constructor: 0.5` → 500). The two
  remaining bracket lookups (compute.ts:107 `benefits[bid]`, :123
  `usage[key]`) cannot reproduce the vector: usage keys always contain a colon
  from `instanceKey`, and `benefits['__proto__']` is `Object.prototype` whose
  `.status`/`.effective_to` are undefined, so `faceValueFor`'s ownEntry guard
  yields 0 — never NaN. `Object.hasOwn` is fine at the package's ES2022 target.
- Six regression rows genuinely pin the vectors: `__proto__`/`constructor`
  currency_ids → 0 not NaN (the old code produced `Math.round(points ×
  Function)` = NaN), own-key honor preserved, Zod-parse `__proto__` drop,
  valuations prototype key → fraction 1, and benefit_id `constructor` → zero
  face. `toBe` (Object.is) fails on NaN by construction. Verified 29/29 in
  compute.test.ts, 117/117 package-wide, and full `pnpm -r test` green
  (3+1+47+21+117), ESLint exit 0, Prettier clean on both changed files.
- No regression of round-1 PASS semantics: all twelve t6 rows pass unchanged —
  points face 85000×0.6=51000, default 1→85000, 1.5→127500, no entry→0;
  Saks retired exclusion both directions with the 2026-07-31 boundary
  (`excluded_retired` only when `period_start > effective_to`, history in,
  forward out); portfolio fee total 283500.
- Contract intact: `git diff main...HEAD -- packages/rules/src/roi/input.ts`
  is empty — `RoiInputSchema`/`instanceKey` untouched across both rounds, per
  spec AC5. The `input.ts:59` `in`-check gap (benefit_id `toString`/`constructor`
  slipping the unknown-id reject) is real but spec-fenced ("no `RoiInputSchema`
  change") and benign post-fix; build.md correctly flags it to the parent job
  rather than silently expanding scope.
- No bloat: +12 lines of production code, a doc-comment that explains the why
  (prototype-chain resolution defeating `??` fallbacks), tests use the
  existing `roi()` fixture pattern; the diff's other hunks (overlap/registry*)
  are the t3 merge synced from main, not this job's work.
