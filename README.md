# Credit Card Reward Tracker

Personal tracker for credit-card benefits: catalog, manual tracking, reset/cadence
engine, ROI dashboard, and which-card search. TypeScript pnpm monorepo, no auth,
local-first.

## Setup

Prerequisites:

- **Node.js >= 20** (check `.nvmrc`; `nvm install` if you use nvm)
- **pnpm 10** — ships with Node via corepack: `corepack enable` (the pinned
  version lives in the root `packageManager` field)
- **Build tools** for the `better-sqlite3` native module: on macOS, Xcode
  Command Line Tools (`xcode-select --install`); on Linux, `build-essential` /
  `gcc` and `python3`

```sh
pnpm install        # always first — installs all workspace packages and builds better-sqlite3
pnpm -r test        # runs every package's Vitest suite
```

Run from the repo root so workspace links exist; a stale lockfile or missing
`node_modules` is fixed by re-running `pnpm install` (also when running
`pnpm -r test` from a package subdirectory).

## Development

Web client and API are independent dev processes on independent ports:

```sh
pnpm --filter web dev   # http://localhost:3000
pnpm --filter api dev   # http://localhost:4000 — GET /health returns { "status": "ok", "db": "ok" }
```

Or both at once: `pnpm dev` (parallel across the workspace).

## Environment variables

Copy `.env.example` to `.env` (gitignored) at the repo root to override any
default. Every variable is optional; the API boots with no `.env` at all.
Values are validated at startup (Zod) — an invalid value fails fast with a
message naming the variable.

| Variable        | Applies to    | Default                 | Description                                              |
| --------------- | ------------- | ----------------------- | -------------------------------------------------------- |
| `DATABASE_PATH` | API           | `apps/api/.data/app.db` | SQLite file path. Parent dirs are created if missing.    |
| `API_PORT`      | API           | `4000`                  | Port the API listens on. Wins over `PORT` for the API.   |
| `PORT`          | Web (and API) | `3000` for web          | Web dev port; the API falls back to it if `API_PORT` is unset. |

Both dev processes read the root `.env` (real environment variables always
win over file values).

### Changing ports for concurrent web + API

The two processes never share a port by default (web 3000, API 4000). To
change them, set `PORT` (web) and `API_PORT` (API) in `.env`:

```sh
# .env
PORT=3100
API_PORT=4100
```

or inline for a single run:

```sh
API_PORT=4100 pnpm --filter api dev
PORT=3100 pnpm --filter web dev
```

### Database

The SQLite file is created on first boot at `DATABASE_PATH` (default
`apps/api/.data/app.db`, gitignored). Pending migrations apply automatically
at API boot, so a fresh `DATABASE_PATH` needs no manual step. Drizzle Kit
points at the same path:

```sh
pnpm --filter api db:generate   # generate SQL migrations from src/db/schema.ts (committed under apps/api/drizzle/)
pnpm --filter api db:seed       # migrate to HEAD, then seed the catalog (6 cards, 5 currencies, 54 benefits) — idempotent, safe to re-run
pnpm --filter api db:push       # push schema directly to DATABASE_PATH (dev only)
```

The seed loads `@ccrt/catalog` via upsert by primary key: re-running updates
changed catalog rows in place and never duplicates. `GET /health` pings the
db — `200 {"status":"ok","db":"ok"}` when healthy, `503
{"status":"degraded","db":"error"}` when the db is unreachable; the process
stays up either way.

Schema notes (feature doc §6): money is stored as integer cents (no floats),
dates as ISO `YYYY-MM-DD` text, structured values (reset anchors, overlap
rules, change payloads) as JSON text validated by Zod on read, and
`user_id` defaults to `'local'` (single-user MVP, no auth). No column
anywhere can hold a full card number or CVV; `user_card.last_four` is
display-only.

## Workspace layout

- `apps/web` — Next.js App Router client (`src/app/`, `src/components/`)
- `apps/api` — Fastify REST API (`src/routes/`, `src/db/`, `src/lib/`, `src/config.ts`)
- `packages/catalog` — versioned benefit catalog (seed data, types, validation)
- `packages/rules` — reset/cadence engine (periods, ROI math, overlap detection)
- `packages/shared` — shared client/server types and Zod schemas

Internal packages are private and consumed via `workspace:*`; there is no
publishing setup.

## Commands

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `pnpm install`      | Install all workspace dependencies           |
| `pnpm dev`          | Dev servers for every package, in parallel  |
| `pnpm -r test`      | Vitest suites, one per package               |
| `pnpm -r lint`      | ESLint across all packages                  |
| `pnpm format`       | Prettier (100-col) across the repo           |
| `pnpm format:check` | Prettier check mode                          |

## Product doc

`credit-card-benefits-tracker-feature-doc.md` is the source-of-truth product
document; update it when a shipped feature diverges from it or extends it.
