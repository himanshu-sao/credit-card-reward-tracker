VERDICT: PASS

- Package-interface check (no HTTP surface in this job; exercised `@ccrt/rules`
  the way `apps/api` will consume it): threw a script at `/tmp` importing
  `generateBenefitInstances`, `UserCardDatesSchema`, `GenerateResultSchema`,
  `BenefitInstanceSchema`, `RULES_ENGINE_NAME` via tsx from an apps/api context —
  all five exports resolve and are callable (`exports ok: [ 'function', 'object', 'object', 'object' ]`,
  `RULES_ENGINE_NAME = reset-cadence-engine`).
- Worked examples all reproduce the spec exactly. AC1 CSP anniversary at asOf
  2027-03-10 → exactly 2 instances `2026-03-10→2027-03-09` and `2027-03-10→2028-03-09`,
  second current. AC2 Amex month anchor, open 2026-03-10 → `2026-03-01→2026-03-31`,
  `amount_available_cents: 30000` (full), `prorated: true`. AC4 Global Entry
  multi_year 4, open 2026-10-01 / asOf 2029-12-31 → 1 instance `2026-10-01→2030-09-30`.
  AC6 Aspire Free Night renewal (fee_date 2027-05-01) → `2026-06-15→2027-04-30`
  then `2027-05-01→2028-04-30`.
- No-periods contract: retired Saks (`anchor none`) → `{ kind: 'no_periods',
  reason: 'resets never (one-time benefit)' }`; `spend_threshold` → reason is
  exactly `resets at a spend threshold — consumed by threshold tracking, not periods`.
- Validation and guards: malformed `asOf '2026-13-99'` → ZodError (no partial
  output); `UserCardDatesSchema.safeParse` without `open_date` → `success: false`
  with `path: ['open_date']`; `interval_years: 0` rejected by `ResetAnchorSchema`
  (`Too small: expected number to be >0`); century-span monthly benefit →
  `period generation exceeded the 600-instance guard` (explicit error, not a hang).
  Future `effective_from` on a grid anchor → `{ kind: 'periods', instances: [] }`
  (empty list, distinct from `no_periods`).
- Repo gate re-run independently, all green: `pnpm -r test` (51/51 rules, 47/47
  catalog, 10/10 api, plus shared/web), `pnpm -r lint` exit 0, `pnpm -r format:check`
  exit 0; `git diff main...HEAD -- README.md` empty (spec AC15). No deviations
  found beyond the two already documented in build.md.
