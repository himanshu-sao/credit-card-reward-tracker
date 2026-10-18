# Sub-job 004-t6 — ROI points amounts + retired exclusion (spec)

## Goal

Extend the merged t5 ROI core (`packages/rules/src/roi/compute.ts`) with the two semantics it fenced out: (a) points-valued face value — a non-monetary benefit carrying a `points_amounts` entry gets face value `points_amount × cents_per_point` for the card's `currency_id`, the per-currency override falling back to the catalog's `default_cents_per_point` (parent assumption 5); and (b) the retired-benefit window rule — an instance counts only if `period_start <= benefit.effective_to` when the benefit is retired (parent assumption 6; Saks `effective_to = 2026-07-31`, doc §5.2/§7). Pure function, no I/O; consumes the landed `RoiInputSchema` verbatim — all cross-field rejects (points on a monetary benefit, unknown ids, over-cap usage) are already enforced there.

## Approach

- `packages/rules/src/roi/compute.ts` — resolve `cents_per_point` as `input.cents_per_point[currency_id] ?? catalog default` (import `currencies` from `@ccrt/catalog`, already a dependency — `input.ts` imports `StatusSchema` the same way). Face value per instance: monetary (`amount_cents`) benefits as today; a benefit with `amount_cents: null` and a `points_amounts` entry gets `round(points_amount × cents_per_point)`, then scaled by the same `valuations` fraction as monetary face value; no points entry → zero (t5 behavior, unchanged). Retired rule: if `status === 'retired'`, an in-window instance still contributes only when `period_start <= effective_to`; excluded instances keep their detail row with zero face/used and are distinguishable (e.g. a boolean on the row — name is the builder's call). `value_used` stays cents-based on instance caps (points benefits have `amount_available_cents: null` → used stays 0).
- `packages/rules/src/roi/compute.test.ts` — extend the existing BASE/`roi()` fixture pattern; use the real catalog ids (`aspire-free-night-reward`, `hilton-honors`, `amex-platinum-saks-credit`).
- `packages/rules/src/index.ts` — touch only if a new export is needed; existing exports unchanged.
- Out of scope (sibling sub-jobs): overlap-driven redundancy marking (t7), input-contract docs / product-doc divergence check (t8), any `RoiInputSchema` change.

## Acceptance criteria

1. Goal 4 + edge 3: `aspire-free-night-reward` (amount_cents null, renewal) with `points_amounts: {'aspire-free-night-reward': 85000}` and `cents_per_point: {'hilton-honors': 0.6}` → `face_value_available_cents = 51000` (net reflects it); with no override → catalog default `1` → 85000; with an override above the default (e.g. 1.5) also asserted. All results pass `CardRoiSchema.parse`.
2. Edge 4 + input regression: `no_periods` results (ongoing status, spend-threshold) with no points entry → zero face, no crash; same benefit with a points entry → points face value. Points entry on a monetary benefit (e.g. `csp-hotel-credit`) still rejects at `RoiInputSchema.parse` with ZodError.
3. Goal 3, retired exclusion, both directions: Saks (`status: 'retired'`, `effective_to: '2026-07-31'`) — an instance with `period_end <= 2026-07-31` counts at full value; one with `period_start > 2026-07-31` contributes zero (visible in detail, flagged); boundary `period_start === 2026-07-31` counts; a retired benefit whose instances all fall beyond `effective_to` contributes zero (edge 7).
4. Portfolio fee total: summing `fee_cents` across ROI outputs for all six catalog cards equals 283500 (doc §1.5).
5. Green and contract intact: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` (or `format:check`) pass; `RoiInputSchema`/`instanceKey` untouched; t5 ACs still pass unchanged (additive output-schema fields only).
