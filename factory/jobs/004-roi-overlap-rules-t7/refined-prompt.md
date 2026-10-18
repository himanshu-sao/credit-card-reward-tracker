# Sub-job 004-t7 — ROI redundant-benefit marking (refined prompt)

Parent: 004-roi-overlap-rules. Depends on: **004-roi-overlap-rules-t3**
(merged; its `hilton-diamond-redundant` warning is the input here) and
**004-roi-overlap-rules-t5** (merged; `computeCardRoi` exists). Semantics per
parent `spec.md` (doc §3.9 "show in ROI view").

## Summary

Extend `computeCardRoi` to accept optional overlap results and mark
overlap-flagged benefit ids redundant in its per-benefit breakdown — the
Hilton Diamond case: Aspire held + `hilton-diamond-redundant` warning passed
in → Surpass's `surpass-gold-status` breakdown row is flagged redundant.
`detectOverlaps` results are data in; the ROI function annotates, never
mutates the warnings.

## Files

- `packages/rules/src/roi/compute.ts` (extend)
- `packages/rules/src/roi/compute.test.ts` (extend)
- `packages/rules/src/index.ts` (export updated types if the input shape grows)

## Goals

1. Aspire ROI computed with the Diamond warning passed in → `surpass-gold-status` breakdown row carries a redundant flag.
2. No overlap results passed → no redundant flags anywhere.
3. Warning referencing a benefit id not present in the card's input → ignored, no crash.

## Edge cases

1. Multiple warnings flagging the same benefit → single flag, not duplicates.
2. Redundant flag affects annotation only — never changes face-value or net math.
