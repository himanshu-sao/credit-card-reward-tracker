# Sub-job 004-t8 — Input-contract docs + divergence check (refined prompt)

Parent: 004-roi-overlap-rules. Depends on: **004-roi-overlap-rules-t4**
(merged; `detectOverlaps` public) and **004-roi-overlap-rules-t6** (merged;
ROI semantics complete). Final assembly task of the parent job.

## Summary

Document the ROI + overlap input contract for the Phase-2 API consumer, and
sync docs only where shipped behavior diverges from the product doc.

- `packages/rules/README.md` (create or extend): a "Input contract" section
  documenting `RoiInput` fields — usage records (`amount_used_cents` per
  benefit_instance, 0..cap), valuations (`value_pct` per benefit_id 0–100
  default 100; `cents_per_point` per currency_id, default = catalog default),
  optional `points_amount`, `asOf` and the trailing-12 window rule, and the
  overlap input's `last_ge_application_date` semantics: 4-year coverage,
  warning fires only when a new application at `asOf` starts before existing
  coverage expires, boundary `asOf − 4y` = no overlap.
- Root `README.md` and `credit-card-benefits-tracker-feature-doc.md`:
  update **only if** shipped behavior diverges from what they say.

## Files

- `packages/rules/README.md` (create or extend)
- root `README.md` (only on divergence)
- `credit-card-benefits-tracker-feature-doc.md` (only on divergence)

## Goals

1. `packages/rules/README.md` documents every public input field with types, defaults, and error behavior, matching the shipped Zod schemas **exactly** — doc claims verified against the schema source.
2. GE 4-year rule and its boundary case documented in one place.
3. Product doc / root README unchanged unless a divergence exists (state explicitly in `build.md` if no divergence was found).

## Edge cases

1. Doc/schema drift — if the shipped schema differs from what this task's instructions assume, report the mismatch in `build.md` rather than papering over it.
2. No code changes in this task — docs only; `pnpm -r test` must stay green.
