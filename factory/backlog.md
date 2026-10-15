# Factory backlog

Queue of features for `/factory next` — it takes the first unchecked `- [ ]`
item, marks it `- [x]`, and runs it through the loop. Add items as
`- [ ] <feature text>` lines below, ordered by priority. Detail blocks under
each item are context for the refiner/spec-writer; the checkbox line is the
feature text.

Order matters: each phase depends on the previous one. Run with `/factory
next`, top to bottom.

---

## Phase 0 — Foundation

- [x] Monorepo scaffold and tooling
  - pnpm workspace: `apps/web` (Next.js App Router + TS), `apps/api`
    (Node/Express or Fastify + TS, Zod), `packages/catalog`,
    `packages/rules`, `packages/shared`. Vitest in every package;
    `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` wired at the root
    (Prettier 100 cols, ESLint). Drizzle + better-sqlite3 in `apps/api`
    (`src/db/`), db file path from `DATABASE_PATH` env var, `.env.example`,
    root `README.md` with setup steps and an env-var table (seed it with
    `DATABASE_PATH` and the API/web ports). A trivial passing test per
    package plus one API health endpoint (`GET /health`) prove the wiring.
    Acceptance: fresh clone → `pnpm install && pnpm -r test` green; both apps
    boot (`pnpm --filter api dev`, `pnpm --filter web dev`); README accurate.

## Phase 1 — Domain core (no UI, pure logic)

- [ ] Benefit catalog package with six-card seed data
  - `packages/catalog`: Zod-validated types for Card, Benefit (doc §6
    fields: cadence, reset_anchor, eligible-merchant rules,
    enrollment_required, status lifecycle active/changed/retired/grandfathered,
    effective_from/to, source_url, last_verified_at, verification status).
    Seed all six cards from doc §5, every benefit row, including retired
    Saks (status `retired`, excluded from forward ROI) and every row the doc
    marks *Verify* (flag `verification: "verify"`, with the doc's note).
    Cents-per-point currencies (MR, UR, Hilton, Marriott, Bilt) as
    configurable entities, doc §3.6. Unit tests: schema rejects bad rows;
    totals ($2,535 fees) match doc §1.5; each benefit has a source_url.
- [ ] Reset engine: period generation for every reset anchor
  - `packages/rules`: given (benefit, card open/anniversary/fee dates, "as
    of" date) → BenefitInstance period list, per doc §3.2 anchor types:
    calendar year, half-year (Jan–Jun/Jul–Dec), quarter, calendar month,
    cardmember anniversary year, renewal date, fixed multi-year (every 4
    years), and spend-threshold (no period; consumed by tracker job).
    Doc §7 edge cases are the test matrix: anniversary vs calendar
    boundaries (CSP hotel credit, Bilt Cash), mid-year card opening (first
    period prorated/flagged), leap-day anniversaries, period boundaries
    exactly at "as of", retired benefits stop generating forward instances
    but keep history. Pure functions, no db, exhaustive unit tests — this
    package is the correctness-critical core; reviewers scrutinize hardest.
- [ ] ROI math and overlap detection rules
  - `packages/rules`: (a) per-card ROI per doc §3.6 — fee, face value
    available, value used, net position, realistic-value mode (per-benefit
    personal value pct), retired benefits excluded forward but included for
    past periods, cents-per-point conversion for points-valued benefits;
    (b) overlap rules per doc §3.9 — CLEAR+ duplication (Platinum +
    Aspire), Global Entry 4-year window across CSP/Brilliant/Platinum,
    airline credit rules, hotel portal credits can't stack, Priority Pass
    best-path, Hilton Diamond (Aspire) makes Surpass Gold redundant — each
    rule emits a message and the affected benefit ids. Pure functions +
    unit tests including the doc's worked examples.

## Phase 2 — API

- [ ] Database schema, migrations, and health/db wiring
  - `apps/api`: Drizzle schema for doc §6 entities (Card, Benefit,
    UserCard, BenefitInstance, UsageEvent, Transaction, ThresholdTracker,
    Reminder, UserValuation, OverlapRule, CatalogChange), migrations,
    seed command that loads `packages/catalog` into the db (idempotent),
    `GET /health` extended with a db ping. Integration test boots a temp
    SQLite file, seeds, and asserts row counts per card.
- [ ] Wallet endpoints: user cards and benefit selection
  - `apps/api`: REST + Zod. `GET/POST /cards` (add a catalog card as
    UserCard: nickname, open_date, anniversary_date, fee_date, AU flag,
    optional last-four display-only), `PATCH/DELETE /cards/:id`,
    `GET /cards/:id/benefits` (instances generated via reset engine),
    per-benefit toggles `PATCH /cards/:id/benefits/:benefitId`
    (track/ignore/enrolled). Validation: open/anniversary/fee date
    coherence (doc §3.1), Zod 400s, no card numbers ever accepted or
    stored. Integration tests per endpoint including error paths.
- [ ] Credit tracker endpoints: instances, usage logging, grouped views
  - `apps/api`: `GET /credits` with `group_by=card|expiry|category`
    (doc §3.3), `POST /credits/:instanceId/usage` (amount, date, note;
    partial-use accumulation to cap; rejects over-cap with 422), `POST
    /credits/:instanceId/usage/:usageId/reverse` (refund/cancellation,
    doc §7), instance status computed (unused/partial/used/expired).
    Use-it-or-lose-it vs carry-forward distinction surfaced in payload.
    Tests: partial use across multiple events, reversal restores
    remaining, expiry respects anchor not "as of".
- [ ] ROI, thresholds, and optimizer endpoints
  - `apps/api`: `GET /roi` (per-card + portfolio, doc §3.6, accepts
    realistic-value overrides), `PUT /settings/valuations` (per-benefit
    value pct, cents-per-point), `GET /thresholds` (Hilton Surpass $15k/$40k,
    Aspire $30k/$60k, Marriott Brilliant $60k, Elite Night Credits 25,
    Bilt Cash balance + year-end expiry — doc §3.7), `POST /spend`
    (log spend toward thresholds), `GET /optimizer?q=` (merchant/category
    search → best card by earn rate + applicable credits + overlap
    warnings, doc §3.8/§3.9). Tests carry the doc's worked examples.

## Phase 3 — Web UI

- [ ] Web shell, navigation, and Wallet screen
  - `apps/web`: App Router layout with the doc §4 screens as routes
    (Home `/`, Wallet `/wallet`, Card detail `/wallet/[id]`, Benefit detail
    `/wallet/[id]/benefits/[benefitId]`, Calendar `/calendar`, Optimizer
    `/optimizer`, ROI `/roi`, Settings `/settings`). API client in
    `packages/shared` types. Wallet screen: six catalog cards to add,
    per-card fee date, progress ring (accessible: text alternative per
    doc §8), next expiry; add-card flow captures open date + toggles.
    Data fetching via server components or RSC + client forms; error and
    empty states. WCAG 2.1 AA basics.
- [ ] Card detail and benefit tracker screens
  - `apps/web`: Card detail — benefit checklist grouped by cadence with
    enrollment badges and status/threshold section (doc §4.3). Benefit
    detail — rules, eligible merchants, usage history, source link +
    last-verified (doc §4.4). Credit tracker views: group by card/expiry/
    category, one-tap "Used" with amount + note, undo/reverse. Realistic
    value and Ignore states respected. Component tests for interaction
    logic; api-tester smoke covers the endpoints.
- [ ] Home dashboard and ROI screens
  - `apps/web`: Home (doc §4.1) — expiring soon, remaining value this
    period, net ROI snapshot, one recommended card. ROI & renewal
    (doc §4.7) — per-card and portfolio value, break-even projection,
    keep/downgrade/cancel summary 60 days before fee. Realistic-value
    editing UI (per-benefit pct sliders, cents-per-point inputs).
    Optimizer search page (doc §4.6). Calendar/timeline page (doc §4.5).
- [ ] Settings, data export, and delete-account
  - `apps/web` + `apps/api`: Settings screen (valuations, notification
    prefs, linked accounts placeholder, doc §4.8). `GET /export` returns
    full user data as JSON (every user table — security reviewer verifies
    completeness). `DELETE /account` permanently deletes everything with
    a typed confirmation in the UI. Doc §3.10: no card numbers stored,
    disclosure that catalog data is community-maintained and may lag.

## Phase 4 — Reminders & polish

- [ ] Reminder scheduling and notifications
  - `apps/api` scheduler: default schedule per doc §3.5 (14/3 days for
    monthly+quarterly, 30/14/3 for semi-annual+annual, 60 days before
    annual fee), smart suppression (fully used or Ignore → no reminder),
    enrollment nudges for enrollment_required benefits, per-benefit
    overrides. Web: notification list on Home + browser notifications
    (web-first MVP; email provider behind an env-flagged stub so tests
    stay offline). Tests use injected clock — schedule at boundaries,
    suppression cases, already-notified dedup.
- [ ] End-to-end smoke test, seed script polish, and release checklist
  - Script that boots API (temp db, seeded) + web, drives the doc §2
    flows over HTTP: add all six cards with real dates, log usages,
    verify tracker/ROI/optimizer responses, export, delete. README
    quickstart verified from a clean clone. Changelog-first commit
    hygiene, `.env.example` complete, dashboard.html wired to board.json.

## Follow-ups from job 001 (post-approval notes)

- [ ] Scaffold polish: apps/web/.prettierignore for .next/; dev.mjs robustness
  - `pnpm format:check` in apps/web fails when a `.next/` build dir exists
    (per-package Prettier doesn't see the root .prettierignore) — fix with a
    one-line `apps/web/.prettierignore` containing `.next/`. Also harden
    `apps/web/scripts/dev.mjs`: handle the child `error` event and don't map
    signal kills to exit 0. Approved as follow-ups in job 001's decision.md.
