# Sub-job 004-t6 — ROI points amounts + retired exclusion (refined prompt)

Parent: 004-roi-overlap-rules. Depends on: **004-roi-overlap-rules-t5**
(merged; extends `src/roi/compute.ts`). Semantics CONFIRMED in parent
`answers.md` / `spec.md` (AC3, AC4).

## Summary

Extend `computeCardRoi` in `packages/rules/src/roi/compute.ts` with two semantics:

1. **Points amounts**: for non-monetary benefits, optional input
   `points_amount` → face value = `points_amount × cents_per_point` for the
   card's `currency_id` (override vs catalog default, both directions).
   No points amount → zero face value. (Points on a monetary benefit is
   already Zod-rejected by the landed input contract — assert via schema
   test, don't re-implement.)
2. **Retired exclusion**: an instance of a retired benefit counts iff
   `instance.period_start <= benefit.effective_to` (Saks:
   `effective_to = 2026-07-31` — history in, forward out).

## Files

- `packages/rules/src/roi/compute.ts` (extend)
- `packages/rules/src/roi/compute.test.ts` (extend)

## Goals

1. `aspire-free-night-reward` with `points_amount: 85000` and Hilton `cents_per_point: 0.6` → face value 51000 cents.
2. Saks: instance with `period_end <= 2026-07-31` counts; instance with `period_start > 2026-07-31` excluded — both directions asserted.
3. Portfolio fee total across all six cards = 283500 (per doc §1.5).
4. `cents_per_point` override below and above catalog default both honored.

## Edge cases

1. Retired benefit whose entire history predates the card's open date → zero contribution.
2. `no_periods` benefits (ongoing status, spend-threshold) contribute nothing unless a points amount is supplied; no crash.
3. Points amount on a monetary benefit → ZodError (from input schema; assertion belongs in `input.test.ts` coverage).
