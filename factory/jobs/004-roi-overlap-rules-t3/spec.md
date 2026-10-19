# Job 004-t3 — Priority Pass + Hilton Diamond overlap rules (spec)

## Goal

Extend the t2 overlap registry in `packages/rules` with the last two doc §3.9 static warnings: `priority-pass-best-path` (Priority Pass appears on Aspire, Bilt, and Brilliant — doc §3.9 "Lounge access") and `hilton-diamond-redundant` (Aspire's Hilton Diamond makes Surpass's Gold redundant — doc §3.9 "Status duplication"). Both are pure data over the t1 `OverlapInput` (wallet card ids + `asOf`), emitting `{ rule_id, message, benefit_ids }` warnings with no ROI mutation (t7 consumes them later).

## Approach

Two files (the refined prompt's `rules.ts`/`rules.test.ts` were merged as `registry.ts`/`registry.test.ts` in t2 — extend those, not new files):

- `packages/rules/src/overlap/registry.ts` — add both rules to `STATIC_RULES` with the seeded benefit ids verified in `packages/catalog` (`aspire-lounge-access` on `hilton-amex-aspire`, `bilt-priority-pass` on `bilt-palladium`, `brilliant-priority-pass` on `marriott-bonvoy-brilliant`, `aspire-diamond-status` on `hilton-amex-aspire`, `surpass-gold-status` on `hilton-amex-surpass`). Add an optional per-rule firing mode to `StaticRule`: default (absent) keeps t2's "any ≥ 2 of its cards held" semantics (used unchanged by the three t2 rules and by the Priority Pass rule, which behaves like the hotel rule — any 2 of 3 fire, all 3 held → all 3 benefit ids listed); a new `all` mode requires **every** listed card held, used only by the directional Diamond rule, which fires iff both `hilton-amex-aspire` and `hilton-amex-surpass` are held and lists both benefit ids, with `surpass-gold-status` naming the degraded benefit. `detectStaticOverlaps` output shape, `OverlapWarningSchema`, the `packages/rules/src/index.ts` exports, and the t1 input contract are unchanged.
- `packages/rules/src/overlap/rules.test.ts` → `packages/rules/src/overlap/registry.test.ts` — extend the existing test file (rename in the refined prompt; the file is `registry.test.ts` on main) following its `valid()`/`ruleIds()` helpers and exact-`toEqual` style.

## Acceptance criteria

1. Wallet `[hilton-amex-aspire, hilton-amex-surpass]` → `hilton-diamond-redundant` fires with `benefit_ids` containing both `aspire-diamond-status` and `surpass-gold-status` (the warning names Surpass's now-redundant Gold status).
2. Any two of `[hilton-amex-aspire, bilt-palladium, marriott-bonvoy-brilliant]` held → `priority-pass-best-path` fires listing exactly those two held benefit ids; all three held → all three ids listed (mirrors the hotel-rule pattern); single-card edge cases — Aspire alone, Surpass alone, any one Priority Pass card alone → neither new rule fires (`hilton-diamond-redundant` is directional: Aspire without Surpass warns about nothing).
3. Full six-card wallet (`chase-sapphire-preferred`, `amex-platinum`, `hilton-amex-aspire`, `hilton-amex-surpass`, `bilt-palladium`, `marriott-bonvoy-brilliant`) → exactly 5 warnings: t2's `clear-plus-reimbursement`, `airline-credit-rules-differ`, `hotel-credit-no-stack` plus `hilton-diamond-redundant` and `priority-pass-best-path`; every warning validates through `OverlapWarningSchema`.
4. Purity preserved: `detectStaticOverlaps` still returns plain data (no ROI computation, no mutation of inputs); t2's three rules behave exactly as before (re-run its existing assertions — the six-card ordering test updates its expected list to the 5 rules above); unknown wallet ids still ignored, duplicate card ids still reject.
5. Green: `pnpm -r test`, `pnpm -r lint`, `pnpm -r format` (or `format:check`) all pass with no changes outside the two `packages/rules/src/overlap/` files (doc comment updates inside them included).
