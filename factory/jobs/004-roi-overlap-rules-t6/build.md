# Sub-job 004-t6 — build summary

STATUS: GREEN

## What changed

Commit `250ee98` on `factory/004-roi-overlap-rules-t6` (2 files, +247/−10):

- `packages/rules/src/roi/compute.ts`
  - `faceValueFor(input, benefitId, amountAvailableCents)`: monetary
    (`amount_available_cents != null`) face value as before; a non-monetary
    benefit with a `points_amounts` entry gets
    `round(points × cents_per_point)` where `cents_per_point` is the input
    override for the card's `currency_id`, falling back to the catalog's
    `default_cents_per_point` (`currencies` imported from `@ccrt/catalog`);
    no points entry → zero (t5 behavior). The result then passes through the
    same `scaleValue` valuation fraction as monetary face value.
  - Retired rule (assumption 6): an in-window instance of a
    `status: 'retired'` benefit counts only when
    `period_start <= benefit.effective_to`; excluded instances keep their
    detail row at zero face/used and are flagged `excluded_retired: true`
    (new additive `InstanceRoiSchema` field). `value_used` stays cents-based
    on instance caps (points benefits have a null cap → used stays 0).
  - Renamed the old private `faceValue` helper to `scaleValue` to make room
    for `faceValueFor`; no other behavior touched.
  - `RoiInputSchema`, `instanceKey`, `input.ts` — untouched (verified by
    `git diff` paths: only the two files above).
- `packages/rules/src/roi/compute.test.ts` — 12 new tests (23 total in the
  file) using real catalog ids (`aspire-free-night-reward`,
  `amex-platinum-flights-earning`, `amex-platinum-saks-credit`), plus the one
  existing `toEqual` row extended with `excluded_retired: false`.
- Fenced out per spec: redundancy marking (t7), docs/product-doc sync (t8).
  No env vars introduced, so the README env-var table is unchanged.

## Testing (evidence)

Command: `pnpm -C "$TMPDIR/004-t6-build" --filter @ccrt/rules test`
(the pnpm wrapper surfaces only sandbox cert-store noise; equivalent direct
run `pnpm exec vitest run` from `packages/rules`, pasted below).

Rules package — all green:

```
Test Files  11 passed (11)
      Tests  94 passed (94)
```

ROI suite detail (`pnpm exec vitest run src/roi/compute.test.ts
--reporter=verbose`), the t6 acceptance rows:

```
 ✓ AC1 — points face value: override vs catalog default, both directions > 85000 points × override 0.6 → 51000 cents face (net reflects it)
 ✓ AC1 — points face value: override vs catalog default, both directions > no override → catalog default 1 → 85000 cents
 ✓ AC1 — points face value: override vs catalog default, both directions > override above the default (1.5) also honored
 ✓ AC1 — points face value: override vs catalog default, both directions > no points entry → zero face value (t5 behavior unchanged); used stays 0
 ✓ AC2 — no_periods benefits: zero without points, points face with an entry > no points entry → zero face value, no crash
 ✓ AC2 — no_periods benefits: zero without points, points face with an entry > points entry → points face value (20000 × default 1)
 ✓ AC2 — no_periods benefits: zero without points, points face with an entry > points entry on a monetary benefit still rejects at RoiInputSchema.parse
 ✓ AC3 — retired exclusion (Saks effective_to 2026-07-31), both directions > instance with period_end <= effective_to counts at full value
 ✓ AC3 — retired exclusion (Saks effective_to 2026-07-31), both directions > instance with period_start > effective_to contributes zero, flagged in detail
 ✓ AC3 — retired exclusion (Saks effective_to 2026-07-31), both directions > boundary period_start === effective_to counts
 ✓ AC3 — retired exclusion (Saks effective_to 2026-07-31), both directions > all instances beyond effective_to → zero contribution (edge 7)
 ✓ AC4 — portfolio fee total across all six catalog cards = 283500 > sums annual_fee_cents from the ROI output per card
```

Full monorepo (`pnpm -r test`):

```
packages/shared test:       Tests  3 passed (3)
apps/web test:             Tests  1 passed (1)
packages/catalog test:     Tests  47 passed (47)
apps/api test:             Tests  21 passed (21)
packages/rules test:       Tests  94 passed (94)
```

Lint (`pnpm -r lint`): all packages `Done`, exit 0.
Format: `prettier --check` on both changed files →
`All matched files use Prettier code style!` (and `pnpm -r format` ran
clean across the workspace).

## Acceptance criteria

1. **Points face value, both directions** — PASS. AC1 tests:
   override 0.6 → 51000 (with `net_available_cents = -4000` and the
   per-benefit row asserted); no override → catalog default 1 → 85000;
   override 1.5 → 127500; no entry → 0. Every result goes through
   `CardRoiSchema.parse` (the shared `roi()` fixture does the parse on both
   input and output).
2. **no_periods + input regression** — PASS. AC2 tests: a synthetic
   in-window instance of the ongoing `amex-platinum-flights-earning`
   benefit contributes zero with no points entry (no crash, `in_window:
   true`) and 20000 cents with a points entry; `points_amounts` on the
   monetary `csp-hotel-credit` throws `/points amount not allowed/` at
   `RoiInputSchema.parse` (the landed reject, asserted not re-implemented).
3. **Retired exclusion, both directions** — PASS. AC3 tests with real Saks
   facts (`retired`, `effective_to: '2026-07-31'`): period ending 2026-07-31
   counts at full 10000; period starting 2026-08-01 contributes zero with
   `in_window: true`, `excluded_retired: true`, face 0, and no per-benefit
   row; boundary `period_start === 2026-07-31` counts; two instances all
   beyond `effective_to` → zero contribution, both flagged (edge 7).
4. **Portfolio fee total 283500** — PASS. AC4 computes `computeCardRoi` for
   each of the six `cards` from `@ccrt/catalog` (9500 + 89500 + 55000 +
   15000 + 49500 + 65000) through `RoiInputSchema.parse` +
   `CardRoiSchema.parse` and sums `fee_cents` → 283500 (doc §1.5).
5. **Green, contract intact** — PASS. `pnpm -r test` 166 tests green across
   the monorepo (up from 154: +12 t6 tests), lint and format clean;
   `git diff main...HEAD --stat` shows exactly the two files —
   `input.ts`/`instanceKey`/`RoiInputSchema` untouched; all eleven t5
   compute tests pass unchanged (their only edit is the additive
   `excluded_retired: false` literal in one `toEqual`).

## Commit

- `250ee98` — `feat(rules): points face value and retired-benefit exclusion
  in ROI core` on `factory/004-roi-overlap-rules-t6`.
