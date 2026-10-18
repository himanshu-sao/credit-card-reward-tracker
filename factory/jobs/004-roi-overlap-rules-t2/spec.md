# Sub-job 004-t2 — Overlap rule registry + 3 static rules (spec)

## Goal

Add to `packages/rules/src/overlap/` the rule registry and the first three doc §3.9 overlap warnings as data-driven pure functions: the `OverlapWarning` output contract (`{ rule_id, message, benefit_ids }` with a Zod schema, parent spec) and `detectStaticOverlaps(input) → OverlapWarning[]` covering the CLEAR+, airline-credit, and hotel-portal rules. It consumes the landed t1 contract `OverlapInputSchema` verbatim — parse, never re-shape — and the registry owns firing: a rule fires only when its affected *catalog* card ids are held, so unknown wallet ids (which pass the schema by t1's decided semantics) and empty wallets yield nothing. No I/O; zod + `@ccrt/catalog` id knowledge only. The time-aware Global Entry rule and the full `detectOverlaps` export are t4; Priority Pass / Hilton Diamond are t3 — do not build them, but the registry shape must let t4's date-aware rule join without reworking the runner.

## Approach

- `packages/rules/src/overlap/registry.ts` (new) — `OverlapWarningSchema` (Zod object: `rule_id: z.string().min(1)`, `message: z.string().min(1)`, `benefit_ids: z.array(z.string().min(1)).min(1)`) plus `OverlapWarning` type, and a registry: an array of plain rule entries `{ rule_id, message, cards: { card_id, benefit_id }[] }` with a uniform firing rule — a rule fires iff **≥ 2 of its `cards` are held in the wallet**, and the warning's `benefit_ids` are exactly the held cards' benefit ids (in registry order). `detectStaticOverlaps(input: OverlapInput)` runs every entry through that check. The three t2 entries, from doc §3.9 and the catalog seed data:
  - `clear-plus-reimbursement` — `amex-platinum`/`amex-platinum-clear-plus` + `hilton-amex-aspire`/`aspire-clear-plus` ("only one CLEAR+ membership needs reimbursement").
  - `airline-credit-rules-differ` — `amex-platinum`/`amex-platinum-airline-incidental-credit` + `hilton-amex-aspire`/`aspire-flight-credit` (informational: one-airline-per-year vs quarterly, distinct eligibility).
  - `hotel-credit-no-stack` — `chase-sapphire-preferred`/`csp-hotel-credit` + `amex-platinum`/`amex-platinum-hotel-credit` + `bilt-palladium`/`bilt-hotel-credit` ("one booking cannot use two portal credits"; ≥ 2 held fires).
- `packages/rules/src/overlap/registry.test.ts` (new, Vitest colocated) — reuse the BASE + `valid(over)` fixture style from `input.test.ts`.
- `packages/rules/src/index.ts` — export `detectStaticOverlaps`, `OverlapWarningSchema`, and `type OverlapWarning` next to the existing overlap export line. No other files.
- Note for t3/t4: static rules ignore `asOf`/`last_ge_application_date` (a missing GE date must not affect them); t4's GE rule is date-dependent and may join the registry as an entry with a predicate or run beside it — t2 does not pre-build that hook.

## Acceptance criteria

1. CLEAR+ rule: wallet `[amex-platinum, hilton-amex-aspire]` → one warning, `rule_id = 'clear-plus-reimbursement'`, `benefit_ids = ['amex-platinum-clear-plus', 'aspire-clear-plus']` (seeded ids; note the Amex row uses hyphens, not underscore); dropping either card from the wallet → no CLEAR+ warning.
2. Airline rule: wallet `[amex-platinum, hilton-amex-aspire]` → `rule_id = 'airline-credit-rules-differ'` with `benefit_ids = ['amex-platinum-airline-incidental-credit', 'aspire-flight-credit']`; wallet `[hilton-amex-aspire]` alone → no warning.
3. Hotel rule fires on ≥ 2 of its three cards: wallet `[chase-sapphire-preferred, amex-platinum]` → `hotel-credit-no-stack` with those two benefit ids; wallet `[hilton-amex-aspire, amex-platinum]` (parent spec AC5 slice) → exactly the CLEAR+ and airline warnings, no hotel warning; all three hotel cards held → warning lists all three benefit ids.
4. Registry owns firing and never throws: empty wallet and wallet `['ghost-card']` (unknown ids pass `OverlapInputSchema` by t1's decided semantics) → `[]`; every wallet with < 2 of any rule's cards → `[]`; every warning validates through `OverlapWarningSchema.parse`; `rule_id`s are stable strings asserted verbatim in tests; input is parsed with `OverlapInputSchema` before evaluation (duplicates still reject there, never here).
5. Green: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` all pass; the new exports land in `packages/rules/src/index.ts` while `OverlapInputSchema` and all job-003/roi exports are unchanged.
