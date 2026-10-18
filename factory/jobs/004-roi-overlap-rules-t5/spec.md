# Sub-job 004-t5 — ROI core: window, nets, realistic value (spec)

## Goal

Add `computeCardRoi(input) → CardRoi` to `packages/rules/src/roi/compute.ts`: for one card, over a trailing-12-month window `[asOf − 12 months, asOf]` (parent `answers.md` Q1), compute both net positions (Q2) — realized `net_used_cents = value_used − fee` and potential `net_available_cents = face_value_available − fee` — with per-benefit realistic value scaling and per-benefit/per-instance detail rows so the UI can re-window. Pure function, no I/O; zod only. It consumes the landed input contract `RoiInputSchema` from `packages/rules/src/roi/input.ts` verbatim — consume, never re-shape, re-validate, or widen it.

## Approach

- `packages/rules/src/roi/compute.ts` (new) — `computeCardRoi` plus a `CardRoiSchema` zod output (job-003 `src/result.ts` style): `fee_cents`, `face_value_available_cents`, `value_used_cents`, `net_used_cents`, `net_available_cents`, and `benefits: [...]` / `instances: [...]` detail rows (per-benefit totals; per-instance `instance_key`, window-included flag, face/used amounts).
- `packages/rules/src/roi/compute.test.ts` (new) — Vitest, colocated; reuse the BASE fixture pattern from `input.test.ts`.
- `packages/rules/src/index.ts` — export `computeCardRoi` and `CardRoiSchema`/`CardRoi` alongside the existing `RoiInputSchema` export. No other file changes.
- Window math via `src/dates.ts` (`addMonths(asOf, -12)`, `compareISO`) — ISO strings throughout, no `Date` objects, no timezone hazards. Instance counts iff `[period_start, period_end]` overlaps the window (inclusive ends), at full face value — never prorated, even when `prorated: true`.
- Realistic value: `valuations[benefit_id]` is a 0..1 **fraction** per the landed contract (default 1). The refined prompt's "value_pct 0–100" maps as `value_pct: 55` → `valuations: {id: 0.55}`; write tests against the contract as landed.
- Scope guards: input is trusted (all cross-field rules already enforced by `RoiInputSchema`); do not add a second validation layer. Out of scope: retired-benefit `effective_to` exclusion (overlap-chain sub-jobs), overlap-driven redundancy marking, points/cents-per-point face value (handled by a sibling sub-job — keep `points_amounts`/`cents_per_point` fields consumed but non-monetary benefits simply contribute zero here).

## Acceptance criteria

1. Goal 1: CSP (fee 9500), one fully-unused $100 anniversary-year instance inside the window, default valuation → `fee_cents = 9500`, `face_value_available_cents = 10000`, `value_used_cents = 0`, `net_used_cents = -9500`, `net_available_cents = 500` (asserted via `CardRoiSchema.parse`).
2. Goal 2 + boundary: same input with `valuations: {'csp-hotel-credit': 0.55}` → face value 5500, `net_available_cents = -4000`; `valuations` of `0` → face value 0; `1` → full face value (goal 2, edge 3).
3. Goal 3: output includes per-benefit detail rows and per-instance detail rows keyed by `instanceKey(benefit_id, period_start)`, each carrying enough (period, face value, used) for the UI to re-window without recomputation.
4. Edge 1 + 2: an instance straddling the window start (`period_start` before `asOf − 12 months`, `period_end` inside) is counted at full value, and a mid-year-opened `prorated: true` instance is counted at full value — neither is scaled.
5. Edge 4 + 5 + green: empty `instances` + zero usage + default valuations → `fee_cents = fee`, `net_used_cents = net_available_cents = -fee`, all detail arrays empty; all window arithmetic goes through `src/dates.ts` ISO helpers (no `Date` anywhere in `compute.ts`); `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` (or `format:check`) all pass, and `RoiInputSchema`/`instanceKey` and all job-003 exports are unchanged.
