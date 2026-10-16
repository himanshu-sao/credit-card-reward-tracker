# Job 003 — user answers to the refiner's questions

1. **Proration (Q1)**: CONFIRMED — full amount, flag only. First period when
   `period_start < open_date` carries the full `amount_available_cents` with
   `prorated: true`; amounts are never scaled.
2. **Renewal first instance (Q2)**: CONFIRMED — yes. `renewal` anchor emits
   one immediate instance at `open_date` (on approval), then renewal-cycle
   periods anchored to `fee_date` (fallback `anniversary_date`, then
   `open_date`), per doc §5.3 "on approval, then each renewal".
3. **No-period anchors (Q3)**: CONFIRMED — discriminated result.
   `{ kind: 'periods', instances } | { kind: 'no_periods', reason }` — never
   a silent empty list, never an exception.
4. **Catalog `every_4_years` label fix (Q4)**: CONFIRMED — out of scope.
   The engine supports `multi_year` generically via `interval_years` and
   documents the contract; the one-line catalog edit stays on the existing
   follow-ups backlog item (job 002 decision.md).

All other assumptions in `refined-prompt.md` stand as written.
