# Job 004-t7 — ROI redundant-benefit marking (spec)

> **SIZE WARNING** — Approach touches **4 files** (`roi/compute.ts`,
> `roi/compute.test.ts`, `roi/input.ts`, `src/index.ts`), one over the
> 3-file gate; the 4th is unavoidable because the new optional input field
> lives in `RoiInputSchema` (`roi/input.ts`), which `index.ts` re-exports.
> Acceptance criteria: 5 (at the limit). Tightly scoped; splitting further
> would separate the schema change from its only consumer. Orchestrator to
> decide: proceed as-is, or send back to the refiner.

## Goal

Extend `computeCardRoi` (merged at t5, `packages/rules/src/roi/compute.ts`) to
accept optional overlap results — `detectOverlaps`' `OverlapWarning[]` — and
mark each warning's `benefit_ids` as redundant in the card's per-benefit
breakdown (doc §3.9 "show in ROI view"). Concrete case: wallet holds Aspire +
Surpass, `detectOverlaps` fires `hilton-diamond-redundant`; computing the
Surpass card's ROI with that warning passed in flags the `surpass-gold-status`
breakdown row (catalog: `packages/catalog/src/benefits-surpass.ts`). Annotation
only: warnings are data in, the function never mutates them, and the flag
never changes face-value, used, or net math.

## Approach

- `packages/rules/src/roi/input.ts` — add an optional `overlap_warnings` array
  of `OverlapWarningSchema` entries to `RoiInputSchema` (default `[]`), so
  every t5 call site compiles unchanged.
- `packages/rules/src/roi/compute.ts` — `BenefitRoi` gains
  `redundant: z.boolean()` (default `false`). Union of warning `benefit_ids`
  that exist in the card's input `benefits` become `redundant: true` rows;
  unknown ids are dropped at runtime (not a zod error). `surpass-gold-status`
  is a `no_periods` status benefit with no instances — emit a zero-valued
  flagged row for a flagged benefit even when it has no in-window instances,
  so the row exists to annotate.
- `packages/rules/src/roi/compute.test.ts` — extend per t5's existing test
  style: reuse the seed-benefit helpers and the `detectOverlaps` output shape.
- `packages/rules/src/index.ts` — re-export the updated `BenefitRoi` schema and
  `RoiInput` type (types are inferred; only the type re-export may need touch).

## Acceptance criteria

1. Surpass card ROI with the wallet-level `hilton-diamond-redundant` warning
   (from `detectOverlaps` on a wallet holding Aspire + Surpass) passed in →
   the `surpass-gold-status` row in the returned `benefits` breakdown has
   `redundant: true` (a zero-valued row, since the status benefit generates
   no instances); all other rows `redundant: false`.
2. Same input without the warning (field absent or `[]`) → no row flagged
   redundant; card-level `face_value_available_cents`, `value_used_cents`,
   `net_used_cents`, `net_available_cents` are byte-identical with and
   without warnings — asserted by computing both and comparing totals.
3. A warning whose `benefit_ids` are not in the card's input `benefits`
   (e.g. the Diamond warning passed while computing Aspire's ROI) → ignored,
   no row added, no crash; output still parses against `CardRoiSchema`.
4. Two warnings both naming `surpass-gold-status` → exactly one flagged row,
   no duplicate row; verified via `pnpm --filter rules test`.
5. Green: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` (or `format:check`)
   all pass, and all t5 `compute.test.ts` assertions still hold unchanged.
