# Security review — 005-db-schema (round 1)

VERDICT: PASS

## What I checked

- **No card numbers / CVV anywhere.** Grepped `apps/api/src/db/schema.ts` and
  the committed migration `apps/api/drizzle/0000_military_rumiko_fujikawa.sql`
  for `card_number|cvv|cvc|pan|token|secret|password|credential`: only
  `user_card.last_four text(4)` exists (display-only, per doc §3.10), plus
  comments. No column can hold a full PAN or CVV. Criterion 6 verified.
- **Aggregator tokens.** No token/credential column exists in any of the 12
  tables. P1 columns `user_card.linked_account_id` and
  `transaction.account_id` are plain nullable ids (not secrets), no endpoint
  uses them, and no vault is needed yet — consistent with the profile
  (nothing usable for secrets is in the main db).
- **SQL injection.** All queries go through Drizzle's query builder with
  parameterized statements; the only raw SQL is the constant
  `` sql`select 1` `` in `apps/api/src/routes/health.ts` (no interpolation).
  The seed uses `insert ... onConflictDoUpdate` with typed values — no string
  concatenation anywhere in the diff.
- **Health endpoint error handling (criterion 4) — re-verified live.** Booted
  the API via `tsx src/server.ts` on a scratch port (4599/4601) with a fresh
  `DATABASE_PATH`: healthy → `200 {"status":"ok","db":"ok"}`; db file removed →
  `503 {"status":"degraded","db":"error"}`; repeated request → still 503,
  process up (no 500, no crash). Matches build.md's evidence.
- **Corrupt file at boot (criterion 9) — re-verified.** Booting against a
  garbage file fails fast with
  `DbError: DATABASE_PATH: cannot open ...: file is not a database.`
  — clear message naming the env var, no stack-trace crash.
- **Attack surface.** No new route beyond `GET /health` (no input handling to
  validate); server still binds `127.0.0.1` only; no new env vars, no secrets
  in code or logs, no new external dependency (`@ccrt/catalog` is a workspace
  package; lockfile churn is peer-dep re-resolution of existing eslint
  packages only). Drizzle injection point (`buildApp(db)`) keeps tests on
  temp files. Export/delete is out of scope for this job; nothing here
  contradicts a future full-coverage design.
- **Tests re-run.** `pnpm --filter @ccrt/api test` → 19/19 passed, matching
  build.md's evidence.

## Non-blocking observation (not a security defect)

- My corrupt-while-running probe did not reproduce build.md's "corrupt →
  503" line: with the live server holding the db in WAL mode, overwriting the
  main file with garbage while the `-wal`/`-shm` sidecars exist passes the
  readonly header probe (SQLite recovers the main file from the WAL), so
  health stays 200. This is SQLite's documented WAL recovery, not a code
  flaw: the spec's required cases — removed file → 503, never 500, process
  stays up — all hold, and corrupt-at-boot fails fast with the clear
  `DbError`. If stricter runtime corruption detection is wanted later, the
  probe could also check the main file's 16-byte header magic; noting for a
  future job, not requesting changes here.
