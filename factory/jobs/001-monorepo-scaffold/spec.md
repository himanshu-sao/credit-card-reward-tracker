# Spec — 001-monorepo-scaffold

## Goal

Scaffold the pnpm monorepo for the credit-card benefits tracker: five packages, tooling, env-var contract, and a health endpoint — everything later jobs extend rather than recreate. Explicitly out of scope: no catalog seed data, no rules-engine logic, no real Drizzle schemas (placeholder table only), no auth, no external services. Scope is strictly green-install-and-boot.

## Approach

**Workspace** — pnpm workspace, five packages, all `private: true`, internal deps via `workspace:*` protocol, no publishing setup:

- `apps/web` — Next.js App Router (`src/app/`, `src/components/`); dev port 3000 via `PORT`/web port env var.
- `apps/api` — Fastify + TypeScript + Zod; dev port 4000 via `API_PORT`/`PORT`; directories `src/routes/`, `src/db/`, `src/lib/`.
- `packages/catalog`, `packages/rules`, `packages/shared` — placeholder libraries with trivial passing tests only.

**Node/pnpm pinning** — root `package.json` carries `engines` (Node >= 20), the `packageManager` field, and a root `.nvmrc`; all three declare consistent versions.

**Root scripts** — `test`, `lint`, `format`, `dev` fan out via `pnpm -r …` to every package. Vitest per package; ESLint for lint; Prettier at 100 cols is the formatting arbiter (`.prettierrc` at root). Root config files: `pnpm-workspace.yaml`, `package.json`, `.nvmrc`, `.gitignore`, `.prettierrc`, `.env.example`, `README.md`.

**API** — `apps/api/src/config.ts` Zod-validates env vars at startup (`DATABASE_PATH`, `API_PORT`/`PORT`) and fails fast naming the offending var; `DATABASE_PATH` defaults to a `.data/app.db`-style path relative to `apps/api` so the API boots with no `.env` present. `apps/api/src/db/schema.ts` holds a minimal placeholder Drizzle table; `drizzle-kit` config points at `DATABASE_PATH`. Drizzle uses the `better-sqlite3` driver. `GET /health` (in `apps/api/src/routes/`) returns `200 { status: "ok" }` and is tested via Fastify `app.inject()` against a unique temp SQLite file that is cleaned up. Parent dir of `DATABASE_PATH` is created if missing (or a clear config error naming the var — never an opaque better-sqlite3 trace). Port-in-use exits non-zero with a readable error.

**Env contract** — commit `.env.example` at root; gitignore `.env`. Root `README.md` documents: setup steps (including `pnpm install` first, and the Xcode CLT / build-tools prerequisite if `better-sqlite3` needs it), an env-var table listing `DATABASE_PATH`, API port, and web port with defaults (`.env.example` matches it exactly), and how to change ports for running web + API concurrently.

**Files to create** (every file this job must add): root — `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.gitignore` (extend existing), `.prettierrc`, `.env.example`, `README.md`; per package — `package.json`, `tsconfig.json`, Vitest config/test file (e.g. `src/smoke.test.ts`); `apps/web` — `next.config.*`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/` (may start empty with a `.gitkeep`); `apps/api` — `src/config.ts`, `src/db/schema.ts`, `src/db/index.ts` (or equivalent drizzle init), `src/routes/health.ts` (or inline in `src/app.ts`), server entry (e.g. `src/server.ts` or `src/index.ts`), `drizzle.config.ts`.

## Acceptance criteria

Builder's build.md must paste real command output as evidence for each:

1. Fresh clone → `pnpm install && pnpm -r test` exits 0 with ≥ 5 passing tests (one per package, including the `/health` API test).
2. `pnpm -r lint` and `pnpm -r format` both exit 0 with no diffs on untouched files.
3. `pnpm --filter api dev` boots on the configured port; `GET /health` returns 200 `{ status: "ok" }` over HTTP (paste the curl command + response).
4. `pnpm --filter web dev` serves the default Next.js App Router page at `localhost:3000`.
5. Setting `DATABASE_PATH=/tmp/x.db` before booting the API creates/uses that file; booting with no `.env` uses the documented default and still passes `/health`.
6. README env-var table lists `DATABASE_PATH`, API port, and web port with defaults; `.env.example` matches it exactly.
7. `apps/api/src/db/schema.ts` and `apps/api/src/config.ts` exist and compile, so later jobs extend rather than create them.
8. Node pinning in place: `.nvmrc` (or `engines`) and the root `packageManager` field both declare Node >= 20 / pnpm consistently.

## Edge cases

1. No `.env` present: API boots using documented defaults (port, `DATABASE_PATH` fallback); no crash, no silently ignored config. — testable (goal 5 test).
2. `DATABASE_PATH` pointing at a nonexistent directory: parent dir created, or clear config error naming the var. — testable.
3. Malformed/empty `.env` (`PORT=`, `PORT=abc`): Zod validation fails fast at startup naming the offending var; no half-booted server. — testable (unit-test the config parser).
4. Port already in use: process exits non-zero with a readable error, not a hang. — document behavior; test if cheap.
5. `pnpm -r test` from a package subdirectory or with a stale lockfile still resolves workspace deps; README documents `pnpm install` first.
6. `better-sqlite3` native build on fresh clone: install succeeds on Node >= 20; if not, README documents the prerequisite (Xcode CLT / build tools).
7. Tests use a unique temp `DATABASE_PATH` per run and clean up — no leftover db files, no collisions.
8. Concurrent `pnpm --filter web dev` and `--filter api dev`: independent ports by default; README documents changing them.

## Notes

- Profile and refined prompt agree; no conflicts. API framework decision (Fastify over Express) was confirmed by the user — do not revisit.
- Six-card catalog, reset/cadence engine, and the doc §6 data model are later jobs; keep placeholders trivial so they are easy to replace.
