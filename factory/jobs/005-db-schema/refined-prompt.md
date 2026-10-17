# Refined prompt — 005-db-schema (mode: feature)

## Diagnosis
- Raw text lists the ten §6 entities but ignores that `packages/catalog` also
  exports **currencies** (5 rows, `card.currency_id` FK target) — a seed command
  that omits them leaves Card rows with dangling references.
- "Idempotent" is untestable as stated: no rule for what happens on re-run when
  a catalog row changed (skip, overwrite, or error).
- No success criteria for `/health` (response shape, status code when the db
  ping fails), so it can't be spec'd or tested.
- "Migrations" doesn't say whether they run at boot or via `pnpm db:migrate`,
  or whether generated SQL is committed — both already have scaffolding in
  `apps/api/package.json`/`drizzle.config.ts`.
- Single-user context (profile: no auth in MVP) vs doc §6's `user_id` columns
  is unresolved.

## Assumptions
1. CONFIRMED (user, answers.md) — Seed loads `currencies` (5 rows) as well as
   `cards` and `allBenefits` (54 rows across 6 cards), since `Card.currency_id`
   must resolve.
2. CONFIRMED (user, answers.md) — `user_id` columns are kept (doc §6) with a
   single default user `'local'` populated by the schema/defaults, so
   multi-user can be added later without a migration; no auth is added now
   (profile: personal tool).
3. CONFIRMED (user, answers.md) — Idempotent = upsert by primary key: re-running
   the seed command produces identical row counts and silently updates changed
   catalog rows in place at this stage (CatalogChange is a table now, but
   change *feed* logic is job 003+ scope / doc §3.11 — nothing writes it in
   this job).
4. CONFIRMED (user, answers.md) — All dates stored as ISO `YYYY-MM-DD` text
   (matching the rules engine's date functions); monetary amounts as integer
   cents (matching catalog schemas). No float money columns.
5. CONFIRMED (user, answers.md) — `Benefit.reset_anchor` and `rules` stored as
   JSON text columns; `OverlapRule.benefit_ids`, `CatalogChange.before/after`
   likewise (SQLite has no array type). Validated by Zod on read in later
   jobs, not by the db.
6. CONFIRMED (user, answers.md) — P1-only columns (`UserCard.linked_account_id`,
   `Transaction.account_id`, `UserCard.last_four` display-only per §3.10) are
   included as nullable columns now to avoid early migrations; no endpoint
   accepts them yet. No column anywhere can hold a full card number or CVV.
7. CONFIRMED (user, answers.md) — Generated migration SQL is committed under
   `apps/api/drizzle/`; both `pnpm --filter api db:generate` (dev) and
   migrations applied at API boot (so tests/dev servers never boot against an
   unmigrated db).
8. CONFIRMED (user, answers.md) — `/health` keeps 200 +
   `{status:"ok", db:"ok"}` when the ping succeeds; returns 503 with
   `{status:"degraded", db:"error"}` when the db query fails, and never throws
   (health is the one endpoint that must not 500).
9. CONFIRMED (by repo) — Drizzle/better-sqlite3 wiring exists
   (`src/db/index.ts` `createDb`, WAL, `DATABASE_PATH` config); the placeholder
   table in `src/db/schema.ts` is replaced by the real schema in this job.
10. CONFIRMED (by repo) — Seed command is a script in `apps/api` (e.g.
    `pnpm --filter api db:seed`) importing `@ccrt/catalog`; the integration test
    boots `createDb` on a temp file, applies migrations, seeds, asserts counts
    derived from the catalog arrays (not hardcoded literals), so the test
    survives catalog edits.

## Open questions
All open questions resolved by the user — see answers.md. Resolved decisions:
1. `ThresholdTracker.benefit_id` is **nullable** — non-benefit trackers
   (Marriott Elite Night Credits, Bilt Cash balance/expiry) must be
   representable.
2. Re-seed = **silent upsert** — changed catalog rows update in place;
   CatalogChange feed logic (doc §3.11) is a later job, nothing writes that
   table in this job.
3. Migrations are **applied at API boot** — dev servers and tests never run
   against an unmigrated db.
4. Single-user default **`user_id='local'` confirmed** — populated by
   schema/defaults, no auth added now.

## Refined prompt
**P1 (single job):** In `apps/api`, replace the placeholder
`src/db/schema.ts` with Drizzle SQLite tables for all doc §6 entities — Card,
Benefit, Currency (implied FK target), UserCard, BenefitInstance, UsageEvent,
Transaction, ThresholdTracker (with nullable `benefit_id` for non-benefit
trackers), Reminder, UserValuation, OverlapRule, CatalogChange (table exists;
nothing writes it in this job) — using integer-cent money columns, ISO
`YYYY-MM-DD` text dates, JSON text for anchor/rules/payload fields, and FKs
with the versioning rule from §6 (benefits are versioned via
`effective_from`/`effective_to`/`status`, never edited in place conceptually).
Generate and commit drizzle-kit migrations under `apps/api/drizzle/`; apply
them at API boot. Add `db:seed` which idempotently (silent upsert by primary
key) loads `currencies`, `cards`, and `allBenefits` from `@ccrt/catalog`
(54 benefits; includes the retired Saks rows so history is preserved — §7).
Extend `GET /health` with a db ping per assumption 8. Integration test: temp
SQLite file → migrate → seed → assert per-card benefit row counts computed
from the catalog package, currency count = 5, and seed re-run idempotence.
Update README env-var/setup sections if any new var or command is introduced.

## Goals
1. `pnpm --filter api db:generate` produces migration SQL covering all 11
   tables; committed; booting the API on a fresh `DATABASE_PATH` applies it
   with no manual step.
2. `pnpm --filter api db:seed` on a fresh db → exact rows:
   cards=6, currencies=5, benefits = `allBenefits.length` (54), benefit count
   per card matches each `benefits-*.ts` array length (csp=6, platinum=16,
   aspire=10, surpass=6, bilt=7, brilliant=9); exits 0.
3. Running `db:seed` twice → identical counts (query for duplicates on
   `benefit.id`/`card.id` returns 0) and changed rows silently updated in
   place; no CatalogChange rows written in this job.
4. `GET /health` with a healthy db → 200 `{"status":"ok","db":"ok"}`; with the
   db file deleted/unwritable → 503 `{"status":"degraded","db":"error"}`,
   process stays up.
5. Integration test in `apps/api` creates a temp SQLite file, migrates, seeds,
   asserts the counts in goal 2, and passes under `pnpm -r test`.
6. No column can store a full card number/CVV (`UserCard.last_four` is
   `text(4)` nullable); `pnpm -r lint` and `pnpm -r format` clean.

## Edge cases
1. Seed on an empty/brand-new db file (parent dirs missing) and on a db that
   already has rows — both reach the same end state, exit 0.
2. Seed re-run after editing a catalog row: upsert updates it; no duplicate
   ids; count unchanged.
3. Corrupt/non-database file at `DATABASE_PATH` → clear error at boot
   (ConfigError-style message naming the var), not a stack-trace crash.
4. `/health` when the db query throws (file removed mid-run, locked db) →
   503 degraded, not an unhandled rejection.
5. Retired benefits (Saks) are seeded, not filtered out — assert at least one
   `status='retired'` row exists; `activeBenefits` (53) differs from
   `allBenefits` (54).
6. Concurrent seed + health ping (WAL mode): no `SQLITE_BUSY` failure.
7. Benefits with `amount_cents = null` (non-monetary, e.g. status benefits)
   and `effective_to = null` round-trip without coercion errors.
8. `*Verify*-flagged catalog rows keep their `note` (profile requirement);
   assert a verify row's note survives the round trip.
9. Migration on a db already at HEAD is a no-op; API boots cleanly twice in a
   row against the same file.
