# Sub-job 004-t6 — build summary (round 2)

STATUS: GREEN

## Round 1 verdicts addressed

- **security = CHANGES** — addressed in commit `3cd889f` (this round). The
  finding: the three record lookups in `compute.ts` used bare bracket access,
  so a schema-valid `currency_id: '__proto__'` (or `'constructor'`) resolved
  through the prototype chain — the lookup returned `Object.prototype` /
  `Function` instead of `undefined`, the `?? default` fallback never fired,
  and `Math.round(points × Function)` produced NaN face value from input that
  had passed `RoiInputSchema.parse`.
- **code = PASS, api = PASS** — no changes requested; nothing reworked.

## Round 2 changes (commit `3cd889f`, 2 files, +105/−3)

- `packages/rules/src/roi/compute.ts` — new 3-line helper
  `ownEntry(record, key)` = `Object.hasOwn(record, key) ? record[key] :
  undefined`, applied at exactly the three flagged lookup sites:
  - `scaleValue`: `ownEntry(input.valuations, benefitId) ?? 1`
  - `faceValueFor`: `ownEntry(input.points_amounts, benefitId)`
  - `faceValueFor`: `ownEntry(input.cents_per_point, input.card.currency_id)
    ?? defaultCents`
  Inherited keys now fall through to the intended default/zero; own entries
  still win. `Object.hasOwn` is available at the package's ES2022 target.
- `packages/rules/src/roi/compute.test.ts` — 6 new regression tests in a
  `round-1 security` describe block (29 tests in the file, 117 in the
  package, up from 94 in round 1 which included t3's registry suites merged
  from main).
- **Not changed, per the reviewer's scope note and the coordinator's
  instruction**: `input.ts` is fenced out of this job and was NOT touched. The
  same class of issue exists there — `input.ts:59`
  (`inst.benefit_id in input.benefits`) lets a benefit_id of `toString` /
  `constructor` slip the unknown-id reject, since `in` walks the prototype
  chain. **Flagged for the parent job**: `input.ts` should switch its
  membership checks to `Object.hasOwn(input.benefits, ...)` (or the records
  should be built null-prototype) when the input contract is next open.

## Testing (evidence)

Branch state: `factory/004-roi-overlap-rules-t6` at `3cd889f`, synced with
main (t3's registry rules merged in; the coordinator performed the sync as
`8c84119`).

Rules package — `pnpm exec vitest run` from `packages/rules`
(the `pnpm --filter @ccrt/rules test` wrapper surfaces only sandbox
cert-store noise under this environment; the direct run is the same
command):

```
Test Files  11 passed (11)
      Tests  117 passed (117)
```

New security regression rows (`pnpm exec vitest run src/roi/compute.test.ts
--reporter=verbose`):

```
 ✓ round-1 security — prototype-chain keys fall back, never NaN > currency_id "__proto__" with no matching override → catalog fallback missing → 0, not NaN
 ✓ round-1 security — prototype-chain keys fall back, never NaN > currency_id "constructor" behaves the same — fallback, not Function → NaN
 ✓ round-1 security — prototype-chain keys fall back, never NaN > an own inherited-name override that survives parse is still honored (constructor: 0.5)
 ✓ round-1 security — prototype-chain keys fall back, never NaN > an own __proto__ override cannot survive RoiInputSchema.parse (setter drops it) → fallback 0
 ✓ round-1 security — prototype-chain keys fall back, never NaN > valuations "__proto__" with no own entry → fraction 1, not Object.prototype → NaN
 ✓ round-1 security — prototype-chain keys fall back, never NaN > benefit_id "constructor" in points_amounts → no own entry → zero face, not NaN
```

What the six rows pin down:

1. `currency_id: '__proto__'`, no override, no catalog row → face 0 (was
   NaN before the fix). `toBe(0)` uses Object.is, so it fails on NaN by
   itself.
2. Same for `currency_id: 'constructor'` → face 0 (was
   `points × Function` → NaN).
3. An own `constructor: 0.5` override that survives parse is still honored —
   1000 points → 500 cents. The guard does not break legitimate entries.
4. An own `__proto__` key cannot survive `RoiInputSchema.parse` (Zod rebuilds
   records with plain assignment; the `__proto__` setter drops it), asserted
   via `Object.hasOwn(parsed.cents_per_point, '__proto__') === false`, and the
   computed ROI falls back to 0 — no NaN either way.
5. `valuations` with a computed `__proto__` key (lands on the prototype via
   the setter, so no own entry) → fraction falls back to 1 → full face 10000
   (was NaN before the fix).
6. `benefit_id: 'constructor'` in the benefits record with no points entry →
   zero face, not NaN.

Full monorepo after the fix (`pnpm -r test`, including t3's suites now on
main):

```
packages/shared test:       Tests  3 passed (3)
apps/web test:             Tests  1 passed (1)
packages/catalog test:     Tests  47 passed (47)
apps/api test:             Tests  21 passed (21)
packages/rules test:       Tests  117 passed (117)
```

Lint (`pnpm -r lint`): all five packages `Done`, exit 0.
Format: `prettier --check` on both changed files →
`All matched files use Prettier code style!`.

## Acceptance criteria (unchanged from round 1, all still green)

All twelve round-1 t6 tests pass unchanged alongside the new security rows —
points face value both directions (0.6 → 51000, default 1 → 85000, 1.5 →
127500, no entry → 0), no_periods zero-without-points / points-face-with,
monetary-points Zod reject, Saks retired exclusion both directions plus the
2026-07-31 boundary, all-beyond-effective_to zero (edge 7), and the
portfolio fee total 283500. `input.ts`, `RoiInputSchema`, `instanceKey`
remain untouched across both rounds: `git diff main...HEAD -- packages/rules/
src/roi/input.ts` is empty.

## Commits on `factory/004-roi-overlap-rules-t6`

- `250ee98` — `feat(rules): points face value and retired-benefit exclusion
  in ROI core` (round 1)
- `a82c5c6` — `docs(factory): job 004-t6 build summary` (round 1)
- `3cd889f` — `fix(rules): guard ROI record lookups against
  prototype-chain keys` (round 2, this review fix)
