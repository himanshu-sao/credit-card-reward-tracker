# Sub-job 004-t4 — Time-aware Global Entry rule + detectOverlaps export (refined prompt)

Parent: 004-roi-overlap-rules. Depends on: **004-roi-overlap-rules-t2**
(merged; extends its rule registry — parallel with t3). Semantics CONFIRMED
in parent `answers.md` Q3 (user overrode the static guess) / `spec.md` (AC5, AC6).

## Summary

Add the sixth doc §3.9 rule to `packages/rules/src/overlap/rules.ts`:
`global-entry-overlap` — fires iff both:

1. CSP or Brilliant is held (GE coverage = `csp-global-entry` + `brilliant-global-entry` only; Platinum has no GE row), and
2. `last_ge_application_date` is present AND a new application starting at `asOf` would begin before the existing 4-year coverage (`last_ge_application_date` + 4 years) expires.

**Boundary (decided, assert it)**: coverage expiring exactly at `asOf`
(`last_ge_application_date = asOf − 4y`) → no overlap, no warning.

Export `detectOverlaps` from `packages/rules/src/index.ts` (public API
complete after this task). Use pure ISO string date math via `src/dates.ts`
(job-003 convention — no `Date` objects, no timezone hazards).

## Files

- `packages/rules/src/overlap/rules.ts` (extend)
- `packages/rules/src/overlap/rules.test.ts` (extend)
- `packages/rules/src/index.ts` (export `detectOverlaps` + warning types)

## Goals

1. Six-card wallet, `last_ge_application_date = asOf − 1y` → exactly 6 warnings including GE on `csp-global-entry` + `brilliant-global-entry`.
2. CSP + Brilliant held, date = `asOf − 4y − 1d` → no GE warning.
3. CSP + Brilliant held, date = `asOf − 3y` → GE warning fires.
4. CSP + Brilliant held, date = `asOf − 4y` exactly → no GE warning (boundary).
5. Missing `last_ge_application_date` with GE cards held → other five rules fire normally, no crash.
6. `detectOverlaps` exported from `src/index.ts`.

## Edge cases

1. Future `last_ge_application_date` → no GE warning.
2. Malformed date never reaches here (t1 schema rejects first) — assert via a type-level comment or test that schema validation is upstream.
3. GE cards not held → date present or absent, no GE warning.
