# Sub-job 004-t8 — Input-contract docs + divergence check (spec)

## Goal

Create `packages/rules/README.md` with an "Input contract" section that documents the ROI and
overlap input contract for the Phase-2 API consumer: every public input field of
`RoiInputSchema` and `OverlapInputSchema` with types, defaults, and error behavior, matching the
shipped Zod schemas **exactly**, plus the trailing-12 window rule, the GE 4-year rule and its
boundary, and the `redundant`-flag semantics. Root `README.md` and
`credit-card-benefits-tracker-feature-doc.md` change only where shipped behavior diverges from
them. Docs-only: no source changes; `pnpm -r test` stays green.

## Approach

- `packages/rules/README.md` (create): "Input contract" section citing the schema sources by path
  (`src/roi/input.ts`, `src/overlap/input.ts`, `src/roi/compute.ts`, `src/overlap/registry.ts`)
  so doc-vs-code drift stays auditable. Field tables keyed to the schemas, not to assumptions.
- Root `README.md` and `credit-card-benefits-tracker-feature-doc.md`: builder reads the relevant
  passages (root README architecture map ~L92–103; product doc §3.9 L104–111, §6 L228
  `UserValuation`), compares against shipped behavior, and edits **only** on real divergence —
  otherwise records "no divergence found" in `build.md` with the quoted passages as evidence
  (per project review policy, no-evidence = CHANGES). Either way build.md lists what was checked.
- Known divergences the builder must adjudicate and document either way:
  1. Product doc §6 `UserValuation` says `value_pct` 0–100; the shipped `RoiInputSchema`
     `valuations` is a **0..1 fraction defaulting to 1** (and the refined prompt's own summary
     repeats the 0–100 wording — doc/schema drift per refined-prompt edge 1: report the mismatch
     in `build.md`, document the shipped 0..1 contract, do not paper over it).
  2. Product doc §3.9 GE row says credits include "possibly Platinum"; shipped `GE_COVERAGE`
     is `csp-global-entry` + `brilliant-global-entry` only.

## Acceptance criteria

1. `packages/rules/README.md` exists and documents every public field of `RoiInputSchema` and
   `OverlapInputSchema` with type, default, and error behavior, verifiable by side-by-side
   reading against `packages/rules/src/roi/input.ts` and `src/overlap/input.ts`: `usage`
   (instance_key → nonnegative int cents, rejected above `amount_available_cents` and on
   unknown keys), `valuations` (0..1 fraction, default 1), `cents_per_point` (positive; default =
   catalog `default_cents_per_point`, falling back to 0), `points_amounts` (positive int;
   rejected on a monetary benefit), `asOf` (strict `YYYY-MM-DD`), `overlap_warnings`
   (default `[]`), `wallet` (non-empty strings; duplicate ids → ZodError; unknown catalog ids
   **pass** — the registry owns firing), `last_ge_application_date` (optional strict ISO).
2. The README documents, in one place each: the trailing-12 window `[asOf − 12 months, asOf]`
   with inclusive ends and full (never prorated) face value; the GE rule — fires only when the
   application is completed (`date <= asOf`) **and** coverage is active (`date + 4y > asOf`),
   boundary `asOf − 4y` = no overlap, absent or future date never fires, coverage = CSP +
   Brilliant only; and `redundant` semantics — annotation only, warning ids not in `benefits`
   are dropped, a flagged benefit with no in-window instances still gets a zero-valued row.
3. Root `README.md` and `credit-card-benefits-tracker-feature-doc.md` are either unchanged with
   `build.md` quoting the passages checked and concluding "no divergence found", or updated only
   for actual divergences, each of which is listed in `build.md` with the old text, the new
   text, and the shipped code that justifies it. The two known candidates above are explicitly
   adjudicated either way.
4. `git diff --stat` for the job shows only `.md` files (plus job-folder docs); no source,
   test, or config files change, and the README field tables cite the schema source files.
5. Green: `pnpm -r test`, `pnpm -r lint`, and `pnpm -r format` (or `format:check`) all pass,
   with real command output pasted in `build.md` as evidence.
