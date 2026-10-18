APPROVE

- **Tests/lint/format run by me, all green** (branch `factory/004-roi-overlap-rules-t5` at 93601f6,
  post-merge with main): `pnpm -r test` exit 0 — rules 73/73 (incl. the 11 new
  `roi/compute.test.ts` cases), api 21/21 (incl. job-005 db tests), catalog 47/47,
  shared 3/3, web 1/1; `pnpm -r lint` and `pnpm -r format:check` exit 0.
- **Semantics match the confirmed contract** (parent `answers.md` Q1/Q2, t5 refined
  prompt): window is `[addMonths(asOf, -12), asOf]` with inclusive-end overlap
  (`period_end >= window_start && period_start <= window_end`); both net positions
  returned (`net_used = used − fee`, `net_available = face − fee`); straddling and
  `prorated: true` instances count at full face value (doc §7 no-scaling); empty input
  → fee-only negative nets with empty detail arrays. All ISO math via `src/dates.ts`
  string helpers — zero `Date` objects. Doc §3.6 overlap (fee, face value, value
  used, net position, realistic-value scaling) is honored; cents-per-point and
  retired exclusion are correctly fenced to t6.
- **Input contract consumed, not re-shaped**: `compute.ts` uses `RoiInputSchema`/
  `instanceKey` verbatim; `value_pct 0–100` maps to the landed 0..1 fraction
  (default 1) as documented in build.md — the AC2 numbers (face 5500,
  `net_available −4000`) assert identical outcomes. Zod output schemas validate
  every test result through `CardRoiSchema.parse`.
- **Process gap the orchestrator should note (not a code defect)**: no
  `round-1/review-*.md` files exist for this job — not in the working tree nor in
  any commit on any branch — even though `factory/board.json` records
  security/code/api all PASS. I could not spot-check the reviewers' verdicts, so I
  performed the scrutiny directly: the diff is 3 files (compute.ts, compute.test.ts,
  +9-line index.ts export) on top of the pre-existing input-contract commit 98f4ab9;
  pure functions, no I/O, no env vars, no secrets, no doc divergence, job-003
  exports untouched. Recommend the orchestrator reconstruct or re-record the review
  artifacts before merging so the audit trail matches the board.
- **Minor follow-ups for later sub-jobs/Phase-2 (non-blocking)**: (1) `value_used`
  is not valuation-scaled while face value is — matches the t5 spec, but the
  realistic-value semantics for *used* value should be settled when the ROI view
  lands; (2) duplicate `(benefit_id, period_start)` instance keys are silently
  last-wins in the input superRefine rather than rejected; (3) build.md's pasted
  pre-merge suite counts are stale (api 2 files/10 tests vs. actual 3/21
  post-merge) — post-merge reality verified green by me.
