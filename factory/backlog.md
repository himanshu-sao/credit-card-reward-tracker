# Factory backlog

Queue of features for `/factory next` — it takes the first unchecked item,
marks it `- [x]`, and runs it through the loop. Add items as
`- [ ] <feature text>` lines below, ordered by priority.

Backlog seeds, derived from the feature doc's MVP scope (doc §10) — likely too
coarse as-is; `/factory next` will refine each one, and splitting a coarse
item into several jobs is the expected outcome:

- [ ] Monorepo scaffold: pnpm workspace, Next.js app (`apps/web`), API service (`apps/api`), package skeletons (`packages/catalog`, `packages/rules`, `packages/shared`), Vitest + Prettier + ESLint wiring, README with setup and env-var table
- [ ] Benefit catalog package: typed, versioned seed data for the six launch cards (doc §5) with cadence, reset anchor, enrollment flags, source URLs, last-verified dates, and *Verify* flags
- [ ] Reset engine: period-instance generation for every reset anchor type (calendar year, half-year, quarter, month, anniversary, renewal, multi-year, spend-threshold) with the doc §7 edge cases
- [ ] Wallet & card setup: add cards from the catalog, per-card fields, per-benefit Track/Ignore/Enrolled toggles
- [ ] Credit tracker: per-benefit instances with amount available/used/remaining, manual usage logging, grouped views
- [ ] Reminders: local notifications with the doc's default schedule and smart suppression
- [ ] ROI dashboard: per-card fee vs value used, realistic-value mode, cents-per-point settings
- [ ] Threshold trackers: Hilton Surpass/Aspire and Marriott Brilliant spend thresholds, elite-night credits, Bilt Cash balance and expiry
- [ ] Which-card-to-use: merchant/category search over earn rates and active credits
- [ ] Overlap detection: CLEAR+, Global Entry, airline credits, hotel portals, lounge access, status duplication (doc §3.9)
