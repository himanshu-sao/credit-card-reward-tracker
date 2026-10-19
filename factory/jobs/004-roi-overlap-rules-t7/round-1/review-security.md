VERDICT: PASS

- **Input validation is complete.** Every `overlap_warnings` entry goes through
  `OverlapWarningSchema` (`rule_id`/`message` non-empty strings, `benefit_ids`
  a non-empty array of non-empty strings) inside `RoiInputSchema`
  (`packages/rules/src/roi/input.ts:56`) — no unvalidated warning data reaches
  `computeCardRoi` or its output. No raw SQL, no secrets, no new deps, no env
  vars, no routes or HTTP surface touched — library-only change in
  `packages/rules`, attack surface unchanged.
- **Prototype-pollution probe passed.** I wrote a scratch test in the worktree
  feeding warnings with `__proto__`, `constructor`, and `toString` as
  `benefit_ids`: `id in input.benefits` (`roi/compute.ts:75`) does match
  inherited record keys, so three zero-valued phantom `redundant: true` rows
  appear in the breakdown — but there is no prototype pollution, no Set
  pollution, no crash, and no math change (zero-valued rows contribute
  nothing to totals; annotation-only invariant holds, AC2 confirms totals
  byte-identical). Display-only oddity requiring a caller to deliberately
  pass inherited-key ids; `detectOverlaps` only emits catalog ids. Hardening
  nit (`Object.hasOwn` over `in`), not a security finding.
- **Duplicate/unknown ids handled.** AC4 shows two warnings naming the same id
  collapse to one flagged row (Set union); AC3 shows ids unknown to the card
  are dropped, no crash, output still parses against `CardRoiSchema`.
- **No import cycle / spec-build agreement.** `overlap/registry.ts` imports
  only zod, `dates.js`, and `overlap/input.js` — the new `roi/input.ts` import
  of the schema is cycle-free. Diff matches build.md's 3-file claim (tests,
  compute, input); `index.ts` untouched and re-exports already carry the new
  field/flag.
- **Verified locally:** `pnpm --filter @ccrt/rules test` in the worktree —
  12 files / 113 tests passed, matching build.md's pasted evidence. No card
  numbers, CVV, issuer passwords, or tokens in scope for this diff.
