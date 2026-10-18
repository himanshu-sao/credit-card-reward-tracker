# Code review — 005-db-schema, round 2

VERDICT: PASS

Scope: the round-1→round-2 delta `git diff 87138aa..HEAD` = 9aa69c8
(`fix(api): health probe reads the db file header, not WAL-sidecar pages`)
+ a699551 (docs). Only `apps/api/src/routes/health.ts`,
`apps/api/src/routes/health.test.ts`, `README.md`, and `factory/…/build.md`
changed — the swap is surgical, matching the surrounding route style.

- **Fix verified correct against all criterion-4 degradation modes.** I
  re-ran the health-probe logic standalone against a live-handle WAL db
  with both sidecars present: healthy w/ sidecars → 200; garbage main file
  w/ sidecars + live handle → 503; chmod-000 → 503 (EACCES); removed file
  → 503, and repeated probes stay 503 (never 500, process up). Edge cases
  hold: file shorter than 16 bytes (`bytes < 16` check, health.ts:25) and
  empty file both degrade. The magic-header read can't be satisfied from
  the `-wal`/`-shm` sidecars, so the round-1 false positive (stale
  WAL-served pages → 200 on a corrupt/chmod-000 main file) is gone, and a
  healthy WAL db carries the header from creation (before any checkpoint),
  so no false degradation. 503 body pinned as
  `{"status":"degraded","db":"error"}` in health.test.ts:31,69,81,91.
- **Evidence in build.md's "Round 1 rework" section is real; re-verified.**
  `pnpm -r test`: shared 3/3, web 1/1, catalog 47/47, api 21/21 (3 files,
  matches build.md), rules 51/51 — all passed. `pnpm -r lint` → zero
  problems (grep over output: 0 hits). `pnpm -r format:check` → "All
  matched files use Prettier code style!" ×5. Test isolation via the
  `withHealthApp` helper (health.test.ts:15-29) is sound: unique db file
  per case, `finally` closes app + db handle and force-removes main and
  both sidecar files.
- **fd hygiene is correct**: `closeSync(fd)` in `finally` (health.ts:29),
  so a throw on short read or bad magic can't leak the descriptor;
  permission-error path throws out of `openSync` before any fd exists.
  `latin1` comparison of the 16-byte magic (`health.ts:25`) is exact —
  no encoding pitfalls.
- One theoretical residual, noted, not a defect: a file whose 16-byte
  header is intact but whose later pages are garbage probes 200 — but I
  verified the live handle still serves committed WAL data fine in that
  state (`select * from t` → ok), so the process genuinely is functional
  there; no in-process probe could or should do better without mutating
  the db (a checkpoint-and-reopen approach was rightly rejected in
  build.md:189-193).
- Docs current: README health-semantics line now names the exact
  degradation triggers ("missing, unreadable, or not a valid SQLite
  file") — matches shipped behavior. Round-1 non-blocking seed.ts
  reduce note was not made worse (seed untouched in this delta); still
  non-blocking, not requested.
