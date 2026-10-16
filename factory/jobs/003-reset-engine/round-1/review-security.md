VERDICT: PASS

# Security review — job 003 reset engine (round 1)

Scope: `git diff main...factory/003-reset-engine` (3 commits, all in
`packages/rules/` plus workspace-dep wiring in `package.json` /
`pnpm-lock.yaml`). Pure-logic package: no db, no HTTP, no I/O.

## What I checked

- **Deps**: only addition is `@ccrt/catalog` as a `workspace:*` link
  (`packages/rules/package.json`, `pnpm-lock.yaml`) — no new external
  packages; runtime deps remain zod + workspace links. Grep over the diff
  for `fetch|require(|fs|http|process|child_process|eval|new Function`
  finds nothing.
- **Untrusted input handling**: `generateBenefitInstances` Zod-parses the
  entire input (`benefit` via `BenefitSchema`, `cardDates` via
  `UserCardDatesSchema`, `asOf` via a `isValidISO` refine) before any
  generation (`src/generate.ts:44`); malformed input throws ZodError with
  no partial output. `interval_years <= 0` is rejected by the catalog's
  `ResetAnchorSchema` (`z.number().int().positive()`,
  `packages/catalog/src/benefit.ts:50`) before the engine runs — verified
  by probe below. The internal anchor helpers that would loop on
  `intervalYears: 0` are not exported from `index.ts`, so they are only
  reachable behind the validated entry point.
- **Prototype pollution**: Zod strips unknown keys (`__proto__`,
  `constructor`, extras) on parse and rebuilds plain objects. Probed
  directly with `__proto__`/`constructor` keys injected into both
  `benefit` and `cardDates` — no global pollution, generation proceeds
  normally.
- **Injection / ReDoS**: no SQL, no string-concatenated commands; the only
  regex (`^(\d{4})-(\d{2})-(\d{2})$`, `src/dates.ts:7`) is linear and
  anchored — no ReDoS surface. Date math is pure integer/string arithmetic.
- **DoS bound (600-instance guard)**: enforced inside the loop before each
  push (`src/anchors/shared.ts:39`), so the returned array is hard-capped
  at 600 and the error is explicit. The generator itself terminates at
  `asOf` (a validated `YYYY-MM-DD`, so bounded to year 9999); the worst
  skip-heavy case (far-future `effective_from` over an ~8000-year span)
  completes in <50 ms in my probe — not a hang. 600 is a sane ceiling
  (monthly over 50 years). The only adjacent edge — a date math result
  crossing year 10000 (`dayBefore` of `10000-01-01`) — throws a clean
  TypeError, deterministic, no security impact.
- **Secrets / sensitive data in errors**: guard and TypeError messages
  contain only `benefit.id` and date strings — no card numbers, CVV, or
  credentials anywhere in the package (grep confirms). Nothing widens the
  attack surface beyond the existing localhost/personal deployment: this
  is a pure library with no network, db, fs, or env access.

## Evidence (re-run this round)

`pnpm --filter @ccrt/rules test`:

```
 Test Files  8 passed (8)
      Tests  51 passed (51)
```

`pnpm -r test` (full repo):

```
packages/shared test:  Test Files  1 passed (1) / Tests  1 passed (1)
apps/api test:  Test Files  2 passed (2) / Tests  10 passed (10)
apps/web test:  Test Files  1 passed (1) / Tests  1 passed (1)
packages/catalog test:  Test Files  6 passed (6) / Tests  47 passed (47)
packages/rules test:  Test Files  8 passed (8) / Tests  51 passed (51)
```

Adversarial probes (run in a scratch vitest file, since removed):

```
 ✓ extra keys incl __proto__/constructor are stripped by Zod, no pollution
 ✓ huge span with far-future effective_from terminates fast (skip loop bounded)
 ✓ monthly century span hits the 600 guard quickly, array never unbounded
 ✓ interval_years 0/negative rejected by input schema before engine runs
 Test Files  1 passed (1) / Tests  4 passed (4)
```
