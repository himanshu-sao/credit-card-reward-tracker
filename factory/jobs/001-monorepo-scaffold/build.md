# Build — 001-monorepo-scaffold

STATUS: GREEN

Commit: `2423c45` — `feat(scaffold): pnpm monorepo with five packages, tooling, env contract, /health` (51 files, on branch `factory/001-monorepo-scaffold`).

## What changed

**Root** — `package.json` (private, `packageManager: pnpm@10.20.0`, `engines.node: ">=20"`, root scripts `test`/`lint`/`format`/`format:check`/`dev` fanning out via `pnpm -r`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`, plus `onlyBuiltDependencies` for `better-sqlite3`/`esbuild`/`unrs-resolver` so the native module builds on fresh install), `.nvmrc` (`22`), `.prettierrc` (100 cols), `.prettierignore`, `.env.example`, `README.md`, extended `.gitignore` (`.env`, `.data/`, `!​.env.example`, coverage).

**apps/web** — Next.js 15 App Router skeleton: `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/.gitkeep`, ESLint flat config via `eslint-config-next`, trivial Vitest test importing `@ccrt/shared` to prove workspace resolution. `dev` is plain `next dev` (Next honors `PORT` natively; default 3000).

**apps/api** — Fastify 5 + Zod 4 + Drizzle ORM (better-sqlite3 driver): `src/config.ts` (Zod-validated env, fails fast naming the offending var; `DATABASE_PATH` defaults to `apps/api/.data/app.db`, parent dirs auto-created, dotenv never overrides real env), `src/db/schema.ts` (placeholder Drizzle table), `src/db/index.ts` (`createDb` with WAL), `src/routes/health.ts` (`GET /health` → `{ status: "ok" }`), `src/app.ts` (`buildApp`), `src/server.ts` (entry: EADDRINUSE → `API_PORT: port N is already in use.` + exit 1), `drizzle.config.ts` (self-contained, same `DATABASE_PATH` contract), tests: `config.test.ts` (7 tests) + `routes/health.test.ts` (3 tests, unique temp SQLite file per run, cleaned up in `afterAll`).

**packages/{catalog,rules,shared}** — placeholder libraries (`private: true`, `type: module`, main → `src/index.ts`), one trivial passing Vitest test each; catalog/rules/shared smoke tests import `@ccrt/shared` to prove workspace-protocol resolution. `@ccrt/shared` exports a `HealthStatus` Zod schema that the API's health test validates its payload against.

## Acceptance criteria — evidence

### 1. Fresh clone → `pnpm install && pnpm -r test` exits 0, ≥ 5 passing tests

Verified by wiping `node_modules` in all five packages and reinstalling, then testing:

```
$ rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install
+ prettier 3.9.10
Done in 2.5s using pnpm v10.20.0
(better-sqlite3 install: Done — native module built via onlyBuiltDependencies)

$ pnpm -r test
packages/shared test:  Test Files  1 passed (1)
packages/shared test:       Tests  1 passed (1)
apps/api test:  Test Files  2 passed (2)
apps/api test:      Tests  10 passed (10)
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  1 passed (1)
packages/rules test:  Test Files  1 passed (1)
packages/rules test:       Tests  1 passed (1)
packages/catalog test:  Test Files  1 passed (1)
packages/catalog test:       Tests  1 passed (1)
test exit: 0
```

14 tests across 5 packages, all passing. (Sandbox caveat noted below.)

### 2. `pnpm -r lint` and `pnpm -r format` both exit 0

```
$ pnpm -r lint
packages/shared lint: Done / packages/rules lint: Done / packages/catalog lint: Done
apps/api lint: Done / apps/web lint: Done
LINT EXIT: 0

$ pnpm format:check   (format is write-mode; :check proves idempotence)
packages/rules format:check: All matched files use Prettier code style!
…same for shared, catalog, api, web…
FORMATCHECK EXIT: 0
```

### 3. `pnpm --filter api dev` boots; `GET /health` returns 200 `{ status: "ok" }`

```
$ pnpm --filter @ccrt/api dev &
$ curl -sS -w "\nHTTP %{http_code}\n" http://127.0.0.1:4000/health
{"status":"ok"}
HTTP 200
```

### 4. `pnpm --filter web dev` serves the default page at localhost:3000

```
$ pnpm --filter @ccrt/web dev &
$ curl -sS -w "\nHTTP %{http_code}\n" http://localhost:3000/
<!DOCTYPE html><html lang="en">…<title>Credit Card Reward Tracker</title>…
<main><h1>Credit Card Reward Tracker</h1><p>Placeholder page — the client UI arrives in later jobs.</p></main>…
HTTP 200
```

### 5. `DATABASE_PATH` override creates/uses that file; no `.env` uses the default

```
$ DATABASE_PATH=/tmp/ccrt-final-override.db pnpm --filter @ccrt/api dev &
$ curl -sS http://127.0.0.1:4000/health
{"status":"ok"}
$ ls -la /tmp/ccrt-final-override.db
-rw-r--r-- … 4096 Oct 15 01:47 /tmp/ccrt-final-override.db

$ rm -rf apps/api/.data && pnpm --filter @ccrt/api dev &   # no .env exists
$ curl -sS http://127.0.0.1:4000/health
{"status":"ok"}
$ ls apps/api/.data/
app.db
```

### 6. README env-var table matches `.env.example`

README table lists `DATABASE_PATH` (default `apps/api/.data/app.db`), `API_PORT` (default `4000`), `PORT` (web default `3000`); `.env.example` contains exactly `DATABASE_PATH`, `API_PORT`, `PORT` with the same defaults documented in comments. Both files are in commit `2423c45`.

### 7. `schema.ts` and `config.ts` exist and compile

```
$ cd apps/api && ./node_modules/.bin/tsc --noEmit
exit 0
```

Also proven by `drizzle-kit push` applying the placeholder schema to a fresh db:

```
$ DATABASE_PATH=/tmp/ccrt-drizzle-test.db ./node_modules/.bin/drizzle-kit push
[✓] Pulling schema from database…
[✓] Changes applied
```

### 8. Node pinning consistent

`.nvmrc` = `22`; root `package.json` `engines.node` = `">=20"`; `packageManager` = `"pnpm@10.20.0"`. Verified pnpm 10.20.0 via corepack on Node v22.22.3.

## Edge-case coverage

1. **No `.env`**: covered by config test "boots with no env at all" + the real no-`.env` boot above.
2. **Nonexistent parent dir**: config test "honours DATABASE_PATH and creates a missing parent directory" (verified `existsSync`). Parent being a regular file → `ConfigError`, not an opaque better-sqlite3 trace (tested).
3. **Malformed/empty values**: `PORT=abc` → `PORT: must be a number or empty`; `API_PORT=99999` → `API_PORT: must be <= 65535`; `PORT=` (empty) treated as unset → default applied; `API_PORT`+`PORT` both set → readable conflict error. All unit-tested in `config.test.ts`.
4. **Port in use**: occupied 4000 with a socket, then `pnpm --filter @ccrt/api start` → exit code 1, stderr `API_PORT: port 4000 is already in use.` — no hang.
5. **Stale lockfile/subdir runs**: README documents `pnpm install` first; verified by full wipe + reinstall above.
6. **better-sqlite3 build**: succeeded on Node 22 with pnpm 10's build approval (`onlyBuiltDependencies` in `pnpm-workspace.yaml`); README documents the Xcode CLT / build-essential prerequisite.
7. **Temp db hygiene**: API tests use `mkdtempSync` + pid + timestamp, removed in `afterAll`; no `/tmp/ccrt-*` leftovers after runs.
8. **Concurrent dev**: web 3000 / API 4000 independent by default; README "Changing ports" section shows `API_PORT=… pnpm --filter api dev` and `PORT=… pnpm --filter web dev`.

## Simplification passes (run twice)

Pass 1 removed: unused `src/lib/env.ts` dead helper (replaced with `.gitkeep`), speculative Fastify `db` decoration + module augmentation, an over-clever drizzle.config that imported the async config loader (replaced with self-contained `DATABASE_PATH`-with-default), redundant eslint config import.
Pass 2 fixed: dotenv load condition (was "only if no relevant env set" — now always loads with real env winning, since dotenv never overrides), removed dead `--port ${PORT:-3000}` shell expansion from web scripts (Next honors `PORT` natively), made catalog/rules smoke tests actually import `@ccrt/shared` instead of declaring-but-not-using it. Re-ran tests + lint + format after each pass — all green.

## Environment note (sandbox)

Verification ran inside this machine's sandbox. Full `pnpm install` (network fetch of ~590 packages) and native builds all succeeded inside it, so no difference is expected on a normal clone. pnpm was not previously on PATH; activated via corepack (`pnpm@10.20.0`, matching the root `packageManager`).
