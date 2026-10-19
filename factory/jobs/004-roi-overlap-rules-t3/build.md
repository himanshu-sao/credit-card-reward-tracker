STATUS: GREEN

# Job 004-t3 — Priority Pass + Hilton Diamond overlap rules

Commit: `ddcc4ae` on branch `factory/004-roi-overlap-rules-t3`
Diff: 2 files, 107 insertions(+), 4 deletions(-) — within the ≤3 files / ~200 lines budget.

## What changed

- `packages/rules/src/overlap/registry.ts`
  - Added `priority-pass-best-path` to `STATIC_RULES`: default (absent
    `firing`) semantics — any ≥2 of `hilton-amex-aspire` / `bilt-palladium` /
    `marriott-bonvoy-brilliant` held fires, listing exactly the held benefit
    ids (`aspire-lounge-access`, `bilt-priority-pass`, `brilliant-priority-pass`).
  - Added `hilton-diamond-redundant` with the new optional
    `firing?: 'all'` field on `StaticRule`: fires iff **both**
    `hilton-amex-aspire` and `hilton-amex-surpass` are held, listing
    `aspire-diamond-status` and `surpass-gold-status` (Surpass's now-redundant
    Gold). Absent `firing` keeps t2's ≥2-of-N semantics unchanged for the
    three t2 rules and the Priority Pass rule.
  - Firing logic simplified to a threshold: `all` → `rule.cards.length`,
    default → `2`. `detectStaticOverlaps` output shape, `OverlapWarningSchema`,
    `packages/rules/src/index.ts` exports, and the t1 input contract untouched.
  - Header doc comment updated (removed "t3 not built here", documented `all` mode).
- `packages/rules/src/overlap/registry.test.ts`
  - Two new describes (5 new tests) for the Priority Pass rule (any-2 pairs
    via a `cases` loop with exact `toEqual`, all-three case, single-card
    non-firing) and the Diamond rule (fires for the pair naming
    `surpass-gold-status`; directional — neither card alone fires).
  - Six-card wallet test updated to expect exactly 5 warnings
    (`clear-plus-reimbursement`, `airline-credit-rules-differ`,
    `hotel-credit-no-stack`, `priority-pass-best-path`,
    `hilton-diamond-redundant`), length asserted, all validated through
    `OverlapWarningSchema`.

All five benefit ids and card ids were verified against the real catalog seeds
before use: `aspire-lounge-access` (`benefits-aspire.ts:146`), `bilt-priority-pass`
(`benefits-bilt.ts:48`), `brilliant-priority-pass` (`benefits-brilliant.ts:106`),
`aspire-diamond-status` (`benefits-aspire.ts:104`), `surpass-gold-status`
(`benefits-surpass.ts:62`); card ids via each file's `CARD_ID` constant
(`hilton-amex-aspire`, `bilt-palladium`, `hilton-amex-surpass`,
`marriott-bonvoy-brilliant`).

## Acceptance criteria — evidence

### AC1: Aspire + Surpass → `hilton-diamond-redundant` with both benefit ids

Test: "fires for [hilton-amex-aspire, hilton-amex-surpass] naming the redundant
Gold status" (exact `toEqual` on the full warning, including
`benefit_ids: ['aspire-diamond-status', 'surpass-gold-status']`).

```
✓ src/overlap/registry.test.ts > detectStaticOverlaps — Hilton Diamond redundancy (t3) > fires for [hilton-amex-aspire, hilton-amex-surpass] naming the redundant Gold status 0ms
```

### AC2: Priority Pass any-2 / all-3 / single-card edges

Tests: any-2 pairs (exact two held ids asserted per pair), all-3 (all three
ids listed), singles (Aspire alone, Surpass alone, each Priority Pass card
alone → no new rule fires — Surpass-only covered under "is directional").

```
✓ src/overlap/registry.test.ts > detectStaticOverlaps — Priority Pass best path (t3) > fires listing exactly the two held benefit ids for any 2 of its 3 cards 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — Priority Pass best path (t3) > lists all three benefit ids when all three Priority Pass cards are held 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — Priority Pass best path (t3) > does not fire for a single Priority Pass card 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — Hilton Diamond redundancy (t3) > is directional — neither card alone fires it 0ms
```

(The pre-existing "returns [] for an empty wallet", "returns [] for unknown
card ids", and "returns [] when fewer than 2 of any rule's cards are held"
tests also still pass and cover the remaining single-card edges — e.g.
`['amex-platinum', 'hilton-amex-surpass']` and `['chase-sapphire-preferred',
'hilton-amex-aspire']` yield no new warnings.)

### AC3: Full six-card wallet → exactly 5 warnings, all schema-valid

Test: "full six-card wallet yields exactly 5 warnings, all valid through
OverlapWarningSchema" — asserts the ordered rule-id list, `toHaveLength(5)`,
and `OverlapWarningSchema.parse` on each.

```
✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > full six-card wallet yields exactly 5 warnings, all valid through OverlapWarningSchema 1ms
```

### AC4: Purity + t2 rules unchanged + unknown/duplicate handling

All t2 assertions re-run green (CLEAR+ pair, dropping either card kills it,
airline needs both, hotel any-2 and all-3, exact-pair ordering); the
duplicates-reject and unknown-ids-pass tests re-run green; `detectStaticOverlaps`
still re-parses via `OverlapInputSchema` and returns plain data (the diff adds
no mutation or ROI computation — both new rules are pure data entries plus a
threshold expression).

```
✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > CLEAR+ rule fires for [amex-platinum, hilton-amex-aspire] with seeded benefit ids 2ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > dropping either CLEAR+ card kills the CLEAR+ warning 1ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > airline rule needs both cards — Aspire alone yields no warning 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > hotel rule fires on any 2 of its 3 cards 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > hotel rule lists all three benefit ids when all three cards are held 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — the three static rules > wallet [hilton-amex-aspire, amex-platinum] yields exactly CLEAR+ and airline warnings 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > returns [] for an empty wallet without throwing 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > returns [] for unknown card ids (schema passes them; registry ignores them) 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > returns [] when fewer than 2 of any rule's cards are held 0ms
✓ src/overlap/registry.test.ts > detectStaticOverlaps — registry firing semantics > re-parses input with OverlapInputSchema — duplicates reject before evaluation 0ms
```

### AC5: Green — full suite, lint, format

`pnpm -r test` (all workspaces):

```
packages/shared test:  Test Files  1 passed (1)
packages/shared test:       Tests  3 passed (3)
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  1 passed (1)
packages/catalog test:  Test Files  6 passed (6)
packages/catalog test:       Tests  47 passed (47)
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  21 passed (21)
packages/rules test:  Test Files  12 passed (12)
packages/rules test:       Tests  99 passed (99)
```

Focused run (`npx vitest run src/overlap/registry.test.ts` inside
`packages/rules`): `Test Files 1 passed (1)`, `Tests  17 passed (17)` —
was 12 tests on main, now 17.

`pnpm -r lint` — all five lintable projects `Done`, no findings.

`pnpm -r format:check` — all five projects "All matched files use Prettier
code style!" (exit 0).

Changes are confined to the two `packages/rules/src/overlap/` files
(`git status` after commit shows a clean tree there; only ignored
`node_modules` symlinks remain untracked).

## Simplification passes

Two de-bloat passes were run over `git diff main...HEAD` before committing:
pass 1 removed `as const`/double-cast gymnastics in the test's pair-cases
loop (now a plain `[string[], string[]][]`), trimmed the over-explaining
registry header comment, and replaced the boolean-ternary firing expression
with a `threshold` constant; pass 2 found nothing further to remove.
Tests/lint/format re-run green after simplification.

## Notes

- The spec asked to verify against `packages/catalog` seed files first — done
  (evidence above); no id was invented.
- The t2 test named `rules.test.ts` in the refined prompt is `registry.test.ts`
  on main; the spec's instruction to extend that file was followed.
