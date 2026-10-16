# Job 004 — user answers to the refiner's questions

1. **ROI window (Q1)**: CONFIRMED — trailing 12 months from `asOf` (instances
   counted whose periods intersect asOf−12 months → asOf, at full face value;
   per-instance detail returned so the window can change later).
2. **Net positions (Q2)**: CONFIRMED — both. Return realized (used − fee) and
   potential (available − fee) net positions so the UI can show them
   separately.
3. **Global Entry window (Q3)**: USER CHOSE time-aware. The GE overlap rule
   tracks a last-GE-application date input and only warns when the 4-year
   window would overlap (i.e. a new application's coverage would start before
   the existing one expires). The refiner's guess was static-only — override
   it: define the last-application-date input as part of the overlap input
   contract (caller-supplied, like usage/valuations; the Phase-2 API persists
   it). Catalog coverage remains CSP + Brilliant only (Platinum has no GE
   row).
4. **Break-even projection / renewal summary (Q4)**: CONFIRMED — out of scope.
   Deferred until usage-pace data exists (Phase-2 API), matching the backlog's
   later ROI-screen item.

All other assumptions in `refined-prompt.md` stand as written.
