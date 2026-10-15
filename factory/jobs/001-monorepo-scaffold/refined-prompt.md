# Refined prompt — 001-monorepo-scaffold

## Diagnosis
- The repo contains only the feature doc and factory state; everything downstream (catalog, rules engine, API, web) lands on this scaffold, so package boundaries and tooling must match the factory profile exactly on day one.
- The backlog leaves the API framework undecided (Express vs Fastify); deciding it now avoids churn when routes land.
- The scaffold's only behavioral surface is wiring: workspace resolution, per-package Vitest, root scripts, a health endpoint, and Drizzle talking to a temp SQLite file.
- README + `.env.example` are acceptance criteria here, not afterthoughts — they are the contract every later job's env vars extend.
- No auth, no real data, no external services in this job — scope is strictly green-install-and-boot.

## Assumptions
1. **CONFIRMED** — **Fastify** over Express for the API: first-class TypeScript, built-in JSON serialization, `app.inject()` for fast in-process endpoint tests (the api-tester can still hit a real port), and Zod plugs into the request lifecycle cleanly. Express would work; Fastify costs nothing extra at this scale and gives better typed ergonomics for later jobs.
2. **CONFIRMED** — pnpm workspace with the five packages from the factory profile (`apps/web`, `apps/api`, `packages/catalog`, `packages/rules`, `packages/shared`); workspace-internal deps via `workspace:*` protocol. All packages are internal-only: `private: true` everywhere, consumed via the workspace protocol — no publishing setup.
3. **CONFIRMED** — Web and API are independent processes in dev: web on `localhost:3000`, API on `localhost:4000` (via `PORT`/`API_PORT` env vars); web calls the API by absolute URL in dev — no Next.js rewrites or shared server needed yet.
4. **CONFIRMED** — Drizzle schema file exists at `apps/api/src/db/schema.ts` but is minimal (e.g. a placeholder table) — the real data model (doc §6) is a later job. `drizzle-kit` config points at `DATABASE_PATH`.
5. **CONFIRMED** — Each package ships with one trivial passing Vitest test proving the runner resolves workspace imports; the API test suite includes a `/health` test against a temp SQLite db.
6. **CONFIRMED** — `DATABASE_PATH` defaults to a `.data/app.db`-style path (relative to `apps/api`) so the API boots with no `.env` present; `.env` is gitignored, `.env.example` is committed.

## Open questions
None — all open questions were answered by the user (both resolved by proceeding with the refiner's guesses: internal-only packages with `private: true`; both `.nvmrc`/`engines` AND `packageManager` for Node pinning), and all assumptions were confirmed.

## Refined prompt
Scaffold the pnpm monorepo for a credit-card benefits tracker (TS throughout, Node >= 20, pinned via both `.nvmrc`/`engines` and the `packageManager` field) per the factory profile: `apps/web` (Next.js App Router, `src/app/`, `src/components/`), `apps/api` (Fastify + TS + Zod, `src/routes/`, `src/db/`, `src/lib/`, `src/config.ts`), and `packages/{catalog,rules,shared}`. Every package is internal-only (`private: true`, workspace-protocol deps, no publishing setup). Wire root scripts `test`/`lint`/`format`/`dev` so `pnpm -r …` fans out to every package (Vitest per package, ESLint, Prettier at 100 cols — Prettier config is the formatting arbiter). Add Drizzle ORM with the `better-sqlite3` driver in `apps/api`, db file path from `DATABASE_PATH`. Add `GET /health` returning `{ status: "ok" }` plus one trivial passing test per package (the API's against a temp SQLite file). Commit `.env.example`, gitignore `.env`, and write the root `README.md` with setup steps and an env-var table seeded with `DATABASE_PATH` and the API/web port vars. Do not implement catalog data, rules logic, or real schemas — placeholders only. Do not add auth. Verify from a fresh-clone state: `pnpm install && pnpm -r test` green, `pnpm -r lint` and `pnpm -r format` clean, and both `pnpm --filter api dev` / `pnpm --filter web dev` boot.

## Goals
1. Fresh clone → `pnpm install && pnpm -r test` exits 0 with ≥ 5 passing tests (one per package, including the `/health` API test).
2. `pnpm -r lint` and `pnpm -r format` both exit 0 with no diffs on untouched files.
3. `pnpm --filter api dev` boots on the configured port; `GET /health` returns 200 `{ status: "ok" }` over HTTP.
4. `pnpm --filter web dev` serves the default Next.js App Router page at `localhost:3000`.
5. Setting `DATABASE_PATH=/tmp/x.db` before booting the API creates/uses that file; booting with no `.env` uses the documented default and still passes `/health`.
6. README env-var table lists `DATABASE_PATH`, API port, and web port with defaults; `.env.example` matches it exactly.
7. `apps/api/src/db/schema.ts` and `apps/api/src/config.ts` exist and compile, so later jobs extend rather than create them.
8. Node pinning is in place: `.nvmrc` (or `engines`) and the root `packageManager` field both declare Node >= 20 / pnpm consistently.

## Edge cases
1. No `.env` present: API boots using documented defaults (port, `DATABASE_PATH` fallback); no crash, no silent ignored config.
2. `DATABASE_PATH` pointing at a nonexistent directory: the API either creates the parent dir or fails with a clear config error naming the var — never an opaque `better-sqlite3` stack trace.
3. Malformed/empty `.env` (e.g. `PORT=` or `PORT=abc`): config validation via Zod fails fast at startup with a message naming the offending var; no half-booted server.
4. Port already in use: process exits non-zero with a readable error, not a hang.
5. Running `pnpm -r test` from a package subdirectory or with a stale lockfile: still resolves workspace deps; document the `pnpm install` first step in the README.
6. `better-sqlite3` native build on a fresh clone (no node_modules): install must succeed on Node >= 20; if it can't, the README documents the prerequisite (Xcode CLT / build tools).
7. Tests must not leave db files behind or collide: the API test uses a unique temp `DATABASE_PATH` per run and cleans up.
8. Concurrent `pnpm --filter web dev` and `--filter api dev`: independent ports by default; README documents changing them.
