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
pnpm --filter api dev   # http://localhost:4000 — GET /health returns { "status": "ok" }
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
| `API_PORT`      | API           | `4000`                  | Port the API listens on. Mutually exclusive with `PORT`. |
| `PORT`          | Web (and API) | `3000` for web          | Web dev port; the API accepts it as its port if `API_PORT` is unset. Do not set both. |

### Changing ports for concurrent web + API

The two processes never share a port by default (web 3000, API 4000). To change
either one, set its variable in `.env` or inline, e.g.:

```sh
API_PORT=4100 pnpm --filter api dev
PORT=3100 pnpm --filter web dev
```

### Database

The SQLite file is created on first boot at `DATABASE_PATH` (default
`apps/api/.data/app.db`, gitignored). Drizzle Kit migrations point at the same
path:

```sh
pnpm --filter api db:generate   # generate SQL migrations from src/db/schema.ts
pnpm --filter api db:push       # push schema directly to DATABASE_PATH
```

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
