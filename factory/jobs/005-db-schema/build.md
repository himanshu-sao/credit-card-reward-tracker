# Build — 005-db-schema

STATUS: GREEN

Built in-session by the orchestrator (builder agent spawns failed 10× with
API timeouts; user approved in-session build). All evidence below is pasted
from real command runs.

## What changed

- `apps/api/src/db/schema.ts` — real Drizzle SQLite schema: 12 tables
  (Currency + the 11 doc-§6 entities Card, Benefit, UserCard, BenefitInstance,
  UsageEvent, Transaction, ThresholdTracker, Reminder, UserValuation,
  OverlapRule, CatalogChange). Integer-cent money, ISO `YYYY-MM-DD` text
  dates, JSON text for `reset_anchor`/`benefit_ids`/`before`/`after`,
  `user_id` defaulting to `'local'`, nullable per answers.md
  (`ThresholdTracker.benefit_id`, `Benefit.amount_cents`,
  `Benefit.effective_to`, P1-only `linked_account_id`, `last_four text(4)`,
  `Transaction.account_id`).
- `apps/api/drizzle/0000_*.sql` — generated migration SQL, committed.
- `apps/api/src/db/migrate.ts` — `migrateDb(db)` applying committed migrations
  via drizzle-orm better-sqlite3 migrator.
- `apps/api/src/db/seed.ts` — idempotent `db:seed` (upsert by PK; card-level
  provenance `source_url`/`last_verified_at` derived from the card's newest
  benefit); CLI migrates then seeds, exits 0. Script + `@ccrt/catalog`
  dependency added to `apps/api/package.json`.
- `apps/api/src/db/index.ts` — `createDb` wraps open errors in `DbError`
  naming `DATABASE_PATH` (criterion 9).
- `apps/api/src/server.ts` — migrations run at boot before `buildApp`.
- `apps/api/src/app.ts` — `buildApp(db)` takes the injected `Db`.
- `apps/api/src/routes/health.ts` — `GET /health`: db.run(select 1) plus a
  file-existence + readonly header-read probe of `DATABASE_PATH` (the open
  handle keeps working after unlink, so the probe is what catches a
  missing/corrupt file); 200 ok / 503 degraded, never 500.
- `packages/shared/src/index.ts` — `HealthStatus` discriminated union
  ok/degraded (updated smoke tests in web + rules that pinned the old shape).
- `apps/api/src/db/seed.test.ts` — new integration test: temp file →
  migrate → seed → counts derived from `@ccrt/catalog` arrays.
- `apps/api/src/routes/health.test.ts` — updated: healthy 200, shared-schema
  parse, degraded 503 when the db file is removed.
- `README.md` — database section rewritten: boot-time migration, `db:seed`
  idempotency, health semantics, schema conventions. No new env var.

## Acceptance criteria — evidence

1. **Migration generated + committed; fresh-DATABASE_PATH boot applies it.**
   `pnpm --filter @ccrt/api db:generate` output tail:
   ```
   12 tables
   benefit 17 columns 1 indexes 1 fks
   ...
   [✓] Your SQL migration file ➜ drizzle/0000_military_rumiko_fujikawa.sql 🚀
   ```
   Fresh-db boot then `sqlite3 ... "select count(*) from sqlite_master where
   type='table';"` → `13` (12 tables + `__drizzle_migrations`), no manual
   step. `GET /health` over HTTP: `{"status":"ok","db":"ok"} HTTP 200`.

2. **Seed on fresh db: cards=6, currencies=5, benefits=54.**
   `DATABASE_PATH=... pnpm --filter @ccrt/api db:seed`:
   `Seeded 6 cards, 5 currencies, 54 benefits.` — printed counts come from
   the catalog arrays themselves (`cards.length`, `currencies.length`,
   `allBenefits.length`); sqlite3 verification: card=6, currency=5,
   benefit=54.

3. **Re-seed idempotent; CatalogChange empty.**
   Second `db:seed` run: same output, exit 0. sqlite3:
   `select count(*), count(distinct id) from benefit;` → `54|54`;
   `select count(*) from catalog_change;` → `0`.

4. **Health over HTTP: 200 ok / 503 degraded, process stays up.**
   Scratch-port instance (`pnpm --filter @ccrt/api start`, ports 4590/4591):
   ```
   healthy:  {"status":"ok","db":"ok"} HTTP 200
   removed:  {"status":"degraded","db":"error"} HTTP 503   (db file rm'd)
   still up: {"status":"degraded","db":"error"} HTTP 503   (no crash/restart)
   corrupt:  {"status":"degraded","db":"error"} HTTP 503   (garbage written over the file)
   ```
   Implementation note: the boot-time sqlite handle keeps serving after
   unlink (POSIX), so health also probes the path — existsSync + a readonly
   header-read open. That probe is what turns missing/corrupt into 503.

5. **Integration test passes under `pnpm -r test`.**
   `pnpm -r test` final:
   ```
   packages/shared test:  Test Files  1 passed (1)  Tests  3 passed (3)
   apps/web test:        Test Files  1 passed (1)  Tests  1 passed (1)
   packages/catalog test: Test Files  6 passed (6) Tests  47 passed (47)
   apps/api test:        Test Files  3 passed (3) Tests  19 passed (19)
   packages/rules test:  Test Files  8 passed (8) Tests  51 passed (51)
   ```
   seed.test.ts asserts counts derived from `@ccrt/catalog` (`cards.length`
   etc.), never hardcoded literals.

6. **No card-number/CVV columns; lint + format clean.**
   `grep -inE 'card_number|cvv|cvc|pan\b|full_card' apps/api/src/db/schema.ts
   apps/api/drizzle/*.sql` → only comment lines; `last_four` is
   `text('last_four', { length: 4 })`. `pnpm -r lint` → Done ×5, no
   problems. `pnpm -r format:check` → clean.

7. **Seed on brand-new db with missing parent dirs AND on an existing db.**
   `DATABASE_PATH=/tmp/ccrt-acc/nested/deep/dir/app.db pnpm --filter @ccrt/api
   db:seed` → `Seeded 6 cards, 5 currencies, 54 benefits.` `exit=0`
   (parent dirs auto-created by loadConfig). Existing-db case: criterion 3's
   second run over the already-seeded db — same end state, exit 0.

8. **Re-seed after editing a catalog row updates in place.**
   Covered by seed.test.ts "updates a changed catalog row in place on
   re-seed" (row renamed to 'stale name', re-seed, name restored, no
   duplicate ids) — passed in the suite above. The seed writes the catalog's
   current values via `onConflictDoUpdate` on every id.

9. **Corrupt/non-database file at DATABASE_PATH → clear message naming the var.**
   Before the fix: raw `SqliteError: file is not a database` stack trace. After
   wrapping open errors in `createDb`:
   ```
   DbError: DATABASE_PATH: cannot open /tmp/ccrt-acc/fresh/corrupt.db: file is not a database. Delete the file (it holds only rebuildable local data) or point DATABASE_PATH at a valid SQLite file.
   ```
   (Read-only-dir variant: `...: unable to open database file.`)

10. **Retired Saks benefits seeded; history preserved.**
    sqlite3: `select count(*) from benefit where status='retired';` → `1`
    (54 total, 53 active). Also asserted in seed.test.ts (≥1 retired row).

11. **Null amount_cents / effective_to round-trip.** seed.test.ts
    "round-trips null amount_cents and effective_to without coercion" —
    passed (catalog rows with nulls read back null; no coercion).

12. **Verify-flagged rows keep note through seed → read-back.** seed.test.ts
    "keeps notes on Verify-flagged rows through seed → read-back" — passed
    (every `verification === 'verify'` row's note survives).

13. **Concurrent seed + health ping under WAL → no SQLITE_BUSY.** Seed runs
    in a single transaction; better-sqlite3 is synchronous so seed and health
    probes serialize within one process, and WAL readers never block across
    processes (the live health tests in criterion 4 ran concurrently with
    sqlite3 CLI access to the same WAL db with no busy errors; the exclusive-
    lock experiments showed sqlite3 CLI erroring, not the API).

14. **Migration at HEAD is a no-op; boots cleanly twice in a row.**
    ```
    boot 1: healthy
    {"status":"ok","db":"ok"} <- boot 2: healthy (migration no-op)
    ```

15. **user_id defaults to 'local'; ThresholdTracker insert with null
    benefit_id.** seed.test.ts "defaults user_id to local and inserts
    ThresholdTracker with null benefit_id" — passed: `tracker.user_id ===
    'local'` from the schema default, `benefit_id` null.

## Notes for reviewers

- `Card.source_url`/`last_verified_at` are not in the catalog's Card type;
  the seed derives them per card from the newest benefit's provenance
  (doc §3.2 requires provenance on every catalog entry). If the catalog
  later grows card-level provenance, the seed derivation should switch to it.
- `HealthStatus` in @ccrt/shared changed shape (`{status:'ok'}` →
  discriminated union); the web/rules smoke tests that pinned the old shape
  were updated in the same commit.
- build.md written in-session per user approval after 10 builder-agent
  API-timeout failures; reviewers should re-verify any criterion they wish —
  all commands above are reproducible from a clean checkout.
