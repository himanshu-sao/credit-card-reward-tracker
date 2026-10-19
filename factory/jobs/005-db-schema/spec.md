# Spec — 005-db-schema

## Goal

Replace the placeholder `apps/api/src/db/schema.ts` with the real Drizzle SQLite
schema for all doc §6 entities — Card, Benefit, Currency (implied FK target of
`Card.currency_id`), UserCard, BenefitInstance, UsageEvent, Transaction,
ThresholdTracker, Reminder, UserValuation, OverlapRule, CatalogChange — with
integer-cent money columns, ISO `YYYY-MM-DD` text dates, JSON text for
anchor/rules/payload fields, and `user_id` columns defaulting to `'local'`
(single-user MVP, no auth). Generate and commit migrations under
`apps/api/drizzle/`, apply them at API boot, add an idempotent `db:seed`
loading `@ccrt/catalog` (6 cards, 5 currencies, 54 benefits incl. retired Saks),
and extend `GET /health` with a db ping (200 ok / 503 degraded, never 500).

## Approach

- `apps/api/src/db/schema.ts` — 11 tables per doc §6. Money = `integer` cents,
  no floats; dates = `text` ISO `YYYY-MM-DD`; `Benefit.reset_anchor`, `rules`
  JSON text; `OverlapRule.benefit_ids`, `CatalogChange.before/after` JSON
  text (Zod validates on read in later jobs, not the db). Benefits versioned
  via `effective_from`/`effective_to`/`status`. Nullable per confirmed
  decisions: `ThresholdTracker.benefit_id` (non-benefit trackers like Marriott
  Elite Night Credits / Bilt Cash), `Benefit.amount_cents`,
  `Benefit.effective_to`, and P1-only columns `UserCard.linked_account_id`,
  `UserCard.last_four` (`text(4)`, display-only — §3.10: no column anywhere can
  hold a full card number or CVV), `Transaction.account_id`.
- Migrations: `pnpm --filter api db:generate` → commit SQL under
  `apps/api/drizzle/`; apply pending migrations at boot in
  `apps/api/src/server.ts` (before `buildApp`), so tests/dev servers never boot
  against an unmigrated db. Update `db:seed` script in `apps/api/package.json`
  (seed script imports `@ccrt/catalog` — add it to dependencies) using upsert
  by primary key (Drizzle `onConflictDoUpdate`), silent re-seed.
- `apps/api/src/routes/health.ts` — db ping: healthy → 200
  `{"status":"ok","db":"ok"}`; any db error → 503
  `{"status":"degraded","db":"error"}`; wrap in try/catch so it never 500s.
  `buildApp` (`apps/api/src/app.ts`) must accept the `Db` instance (inject
  rather than create, so tests point at a temp file). Extend
  `HealthStatus` in `packages/shared/src/index.ts` to the discriminated union
  ok/degraded shape.
- Tests: `apps/api` integration test (Vitest, existing
  `mkdtempSync` temp-file pattern in `routes/health.test.ts`) — temp SQLite →
  migrate → seed → assert counts **derived from the catalog arrays**
  (`cards.length`, `currencies.length`, `allBenefits.length`,
  `cspBenefits.length`, …), never hardcoded literals.
- Docs: README env-var table (no new env var expected — `DATABASE_PATH`
  exists) and setup section for `db:generate`/`db:seed` commands.
- Catalog stays read-only: `packages/catalog/src/*` is the seed source
  (`cards`, `currencies`, `allBenefits`, `activeBenefits`, per-card
  `*Benefits` arrays); no changes to it.

## Acceptance criteria

1. `pnpm --filter api db:generate` produces migration SQL covering all 11
   tables, committed under `apps/api/drizzle/`; booting the API on a fresh
   `DATABASE_PATH` applies it with no manual step (paste boot output).
2. `pnpm --filter api db:seed` on a fresh db exits 0 with exactly
   cards=6, currencies=5, benefits=`allBenefits.length` (54), per-card counts
   equal to each `benefits-*.ts` array length (csp=6, amex-platinum=16,
   aspire=10, surpass=6, bilt=7, brilliant=9).
3. Re-running `db:seed` → identical counts, zero duplicate `benefit.id`/
   `card.id`, changed catalog rows silently updated in place; **zero rows**
   in `CatalogChange` after seeding (table exists, nothing writes it — feed
   logic is doc §3.11, later job).
4. `GET /health` against a scratch-port instance (`pnpm --filter api dev`):
   healthy db → 200 `{"status":"ok","db":"ok"}`; db file removed/unwritable
   → 503 `{"status":"degraded","db":"error"}`, process stays up (no
   unhandled rejection).
5. Integration test in `apps/api` creates a temp SQLite file, migrates,
   seeds, asserts the counts in criterion 2 with counts derived from
   `@ccrt/catalog`; passes under `pnpm -r test`.
6. `UserCard.last_four` is nullable `text(4)`; no schema column can hold a
   full card number or CVV (grep the schema for evidence);
   `pnpm -r lint` and `pnpm -r format` clean.
7. Edge: seed works on a brand-new db with missing parent dirs AND on a db
   that already has rows — same end state, exit 0 both times.
8. Edge: seed re-run after editing a catalog row → upsert updates it, no
   duplicate ids, total count unchanged.
9. Edge: corrupt/non-database file at `DATABASE_PATH` → clear
   `ConfigError`-style message naming the var at boot, not a stack-trace
   crash.
10. Edge: retired Saks benefits are seeded (assert ≥1 `status='retired'`
    row; `activeBenefits`.length (53) < `allBenefits`.length (54) — history
    preserved per doc §7).
11. Edge: benefits with `amount_cents = null` and `effective_to = null`
    round-trip without coercion errors.
12. Edge: *Verify*-flagged catalog rows keep their `note` through seed →
    read-back (profile requirement).
13. Edge: concurrent seed + health ping under WAL → no `SQLITE_BUSY`.
14. Edge: migration on a db already at HEAD is a no-op; API boots cleanly
    twice in a row against the same file.
15. `user_id` defaults to `'local'` via schema default; `ThresholdTracker`
    row insertable with `benefit_id = null`.

Proof-over-claims: build.md must paste real output for every criterion
(command run + result), and reviewers re-verify any missing evidence as
CHANGES.
