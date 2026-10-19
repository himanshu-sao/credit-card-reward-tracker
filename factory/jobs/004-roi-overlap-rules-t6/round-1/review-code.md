VERDICT: PASS

- ROI math verified independently (not from build.md claims): all 23 tests in
  `packages/rules/src/roi/compute.test.ts` pass, plus the full rules suite
  (94), api (21), catalog (47), shared (3), web (1) — 166 total, matching
  build.md; ESLint exit 0 on `packages/rules` and `apps/api`; Prettier clean on
  both changed files. The pnpm wrapper only emits sandbox cert-store noise
  (stderr); the vitest exit codes are 0.
- Correctness of the two new semantics holds. `faceValueFor`
  (packages/rules/src/roi/compute.ts:65) resolves
  `cents_per_point[currency_id] ?? catalog default` and applies `Math.round`
  before `scaleValue`'s valuation-fraction `Math.round` — 85000×0.6=51000,
  ×1.5=127500, no-override default 1 → 85000 all asserted through
  `CardRoiSchema.parse`. The retired rule at compute.ts:101 flags
  `excluded_retired` only when `in_window && status==='retired' &&
  period_start > effective_to` — history in, forward out; boundary
  `period_start === 2026-07-31` counts, matching the real Saks catalog facts
  (retired, effective_to 2026-07-31). Excluded rows keep zero face/used and no
  per-benefit row appears, per spec.
- Contract intact and additive: `git diff main...HEAD --stat` touches exactly
  `compute.ts` and `compute.test.ts` (plus docs); `RoiInputSchema`,
  `instanceKey`, `input.ts` untouched; the only output-schema change is the
  additive `excluded_retired: boolean` on `InstanceRoiSchema`; all eleven t5
  tests pass with the single additive literal edit. `value_used` stays
  cents-based on instance caps (points benefits carry a null cap → used 0,
  and the input schema's over-cap reject still guards it).
- AC4's constant is real: the six catalog `fee_cents` values sum to 283500
  (verified against `packages/catalog/src/cards.ts` source), and the test
  computes it through `computeCardRoi` outputs rather than hardcoding.
- Docs: no user-facing API or env-var change beyond an additive output field;
  spec fences product-doc sync to t8, README env-var table correctly
  unchanged. Code shape matches the file's existing helper style — no bloat
  found in the diff.
