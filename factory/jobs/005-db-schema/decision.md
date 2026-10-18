APPROVE

Job 005-db-schema — schema, migrations, idempotent seed, health db ping. All
three round-2 reviews PASS with independent re-verification; I re-verified the
load-bearing claims myself rather than relying on them.

What I checked and re-ran (all green, on the branch as merged with main):

- `pnpm -r test` — exit 0: shared 3, web 1, catalog 47, api 21 (3 files, incl.
  the two new health degradation pins), rules 51. `pnpm -r lint` and
  `pnpm -r format:check` both clean, exit 0. Matches build.md's evidence.
- Spec criteria 2/3/7/10 end-to-end on a fresh temp db: seeded twice via the
  real CLI (`node --import tsx src/db/seed.ts` on nested missing dirs), both
  exit 0; sqlite3 confirms cards 6|6 distinct, currencies 5|5, benefits 54|54
  distinct, retired=1, `catalog_change`=0, per-card counts 16/10/9/7/6/6 —
  exactly the spec's csp=6/platinum=16/aspire=10/surpass=6/bilt=7/brilliant=9.
- Criterion 9: corrupt file at `DATABASE_PATH` → clear
  `DbError: DATABASE_PATH: cannot open ...: file is not a database ...` naming
  the var, no stack-trace crash.
- The round-1 finding (health probe false-positive off WAL sidecars), fixed in
  9aa69c8, reproduced independently via `app.inject` on a live-handle WAL db
  with both sidecars present: healthy → 200; garbage main file under live
  handle → 503 (round 1: 200, 8/8); chmod-000 → 503 (round 1: 200, 5/5);
  removed → 503 twice, never 500. The healthy-WAL steady state still returns
  200, so no false degradation. All three round-2 reviewers re-ran their own
  repros 1:1 with the same result.
- Schema review against doc §6: 12 tables (Currency + the 11 entities) present
  in `apps/api/src/db/schema.ts` and in the committed migration SQL; integer-
  cent money, ISO text dates, JSON text for `reset_anchor`/`rules`/
  `benefit_ids`/`before`/`after`; `user_id` defaults to `'local'`;
  nullability matches answers.md (ThresholdTracker.benefit_id, amount_cents,
  effective_to, P1-only columns). `grep` for card-number/CVV columns hits only
  comments; `last_four` is nullable `text(4)`. No token/credential columns —
  P1 aggregator tokens remain vault-bound per profile, nothing lands in the
  main db.
- Docs policy: README updated in the same commits (db section, `db:generate`/
  `db:seed`, health semantics with exact degradation triggers, `DATABASE_PATH`
  already in the env-var table; no new env var introduced). Conventional
  Commits followed; catalog package untouched (read-only seed source).

Residual risks accepted (noted by round-2 reviewers, non-blocking):

- The health probe reads only the 16-byte magic header: a file with an intact
  header but garbage body still probes 200. Inherent to the non-mutating
  approach; the live handle genuinely still serves committed WAL data in that
  state, and a checkpointing probe was rightly rejected as mutating. No action
  for this job.
- Live-TCP evidence is via `app.inject` (sandbox blocks local port binding);
  all three reviewers accepted this both rounds, and it exercises the real
  Fastify route pipeline. First post-merge run on an unrestricted machine
  should include one manual `curl localhost:4000/health` sanity check.
- Process note: the build was done in-session by the orchestrator (10 builder
  API-timeout failures, user approved the deviation). Every acceptance
  criterion has pasted evidence and I re-verified the critical ones above.
- Untracked scratch files `apps/api/undefined.tt.db-shm`/`-wal` sit in the
  worktree (leftovers from a failed script run); they are not in the branch
  diff and can be deleted anytime.

Conditions: none blocking merge. Recommend: delete the two stray
`apps/api/undefined.tt.db-*` files, and carry the health-test isolation
pattern (`withHealthApp`) forward into the endpoints jobs.
