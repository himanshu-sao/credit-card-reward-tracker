# Sub-job 004-t1 — Overlap input contract (spec)

## Goal

Add `OverlapInputSchema` (and its `OverlapInput` type) to `packages/rules/src/overlap/input.ts` — the single input contract every overlap rule task (t2–t4) consumes: a `wallet` of catalog card-id strings, an `asOf` ISO date, and an optional caller-supplied `last_ge_application_date` (doc §3.9 GE rule, user-confirmed answer 3 in `factory/jobs/004-roi-overlap-rules/answers.md`). Pure Zod, no I/O; style, error messages, and test structure match the landed `packages/rules/src/roi/input.ts`.

## Approach

- `packages/rules/src/overlap/input.ts` (new) — Zod object: `wallet: z.array(z.string().min(1))`, `asOf` and optional `last_ge_application_date` using the same `ISODate` refiner as `roi/input.ts` (`isValidISO` from `src/dates.js`, message `must be a valid ISO date (YYYY-MM-DD)`). `.superRefine` rejects duplicate wallet ids with a message in the roi style (e.g. `duplicate card id <id>`). Doc comment records the two decided semantics: unknown card ids **pass** the schema (t2's catalog registry decides firing — do not over-engineer), and dates must be strict `YYYY-MM-DD` (`2026-07-31T00:00:00Z` rejects, consistent with `src/dates.ts` job-003 conventions).
- `packages/rules/src/overlap/input.test.ts` (new, Vitest colocated) — mirror `roi/input.test.ts`'s `BASE` + `valid(over)` helper and `toThrow(/…/)` message assertions.
- `packages/rules/src/index.ts` — export `OverlapInputSchema` and `type OverlapInput` alongside the existing roi export line.

## Acceptance criteria

1. Valid input parses to a typed object: wallet with 2+ unique ids plus ISO `asOf` and ISO `last_ge_application_date` (refined-prompt Goal 1); empty wallet `[]` parses (Goal 4); missing `last_ge_application_date` parses (Goal 5); a one-id wallet parses — no minimum-size rule at schema level (Edge 1).
2. Duplicate card ids in `wallet` → ZodError whose message names the duplicate; duplicate detection is asserted for at least the adjacent-duplicates case.
3. Malformed dates → ZodError matching `/ISO date/`: `asOf` or `last_ge_application_date` of `2026-13-45` (Goal 3) and a time-component string `2026-07-31T00:00:00Z` (Edge 3, decided: strict `YYYY-MM-DD` only).
4. Unknown catalog card ids in `wallet` parse successfully — decided behavior, asserted in a test and stated in the schema's doc comment (Edge 2; t2's registry owns firing).
5. Green: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` all pass; `OverlapInputSchema` and `OverlapInput` are exported from `packages/rules/src/index.ts`; job-003 and roi exports unchanged.
