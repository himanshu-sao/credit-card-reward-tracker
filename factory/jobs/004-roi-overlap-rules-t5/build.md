STATUS: GREEN

# Job 004-t5 — ROI core: window, nets, realistic value

Commit: `8fbca2fc11754a0f7c52df07f130a6433b9e1ed2` on `factory/004-roi-overlap-rules-t5`
(`feat(rules): ROI core — trailing-12 window, both nets, valuation scaling`).

## What changed

| File | Why |
| --- | --- |
| `packages/rules/src/roi/compute.ts` (new, 120 lines) | `computeCardRoi(input) → CardRoi`: trailing-12 window `[addMonths(asOf, -12), asOf]`, both net positions, valuation-scaled face value, per-benefit/per-instance detail rows. `CardRoiSchema`/`BenefitRoiSchema`/`InstanceRoiSchema` Zod outputs in job-003 `result.ts` style. Window math via `src/dates.ts` (`addMonths`, `compareISO`) — zero `Date` objects. Consumes `RoiInputSchema` verbatim; no second validation layer. |
| `packages/rules/src/roi/compute.test.ts` (new, 156 lines) | 11 Vitest cases, colocated, BASE fixture pattern reused from `input.test.ts`. All assertions go through `CardRoiSchema.parse(computeCardRoi(RoiInputSchema.parse(...)))`. |
| `packages/rules/src/index.ts` (+9) | Exports `computeCardRoi`, `CardRoiSchema`/`CardRoi`, `BenefitRoiSchema`/`BenefitRoi`, `InstanceRoiSchema`/`InstanceRoi`. No other lines touched; `RoiInputSchema`/`instanceKey` and all job-003 exports unchanged. |

Semantics per spec: an instance counts iff `[period_start, period_end]` overlaps the window (inclusive ends), at **full** face value — never prorated, even when `prorated: true`. Valuations are the landed contract's 0..1 fraction (default 1); `Math.round` keeps integer cents. Non-monetary benefits (null `amount_available_cents`) contribute zero — points face value is fenced out to the sibling sub-job, as is retired-benefit exclusion.

Per-benefit rows are emitted only for benefits with in-window instances, so empty input yields empty detail arrays (AC5).

## Testing — pasted evidence

### AC1 — CSP default: realized and potential net positions

```
✓ src/roi/compute.test.ts > AC1 — CSP default: realized and potential net positions > fully-unused $100 instance, default valuation, fee 9500 2ms
✓ src/roi/compute.test.ts > AC1 — CSP default: realized and potential net positions > usage counts toward value_used; both nets stay integer cents 0ms
```

Asserts `fee_cents = 9500`, `face_value_available_cents = 10000`, `value_used_cents = 0`, `net_used_cents = -9500`, `net_available_cents = 500` (via `CardRoiSchema.parse`); with full usage, `net_used_cents = 500`.

### AC2 — valuation fraction scaling (0..1 contract; refined prompt's `value_pct: 55` → `valuations: {'csp-hotel-credit': 0.55}`)

```
✓ src/roi/compute.test.ts > AC2 — valuation fraction scales face value (0..1 contract) > value_pct 55 → 0.55 fraction 0ms
✓ src/roi/compute.test.ts > AC2 — valuation fraction scales face value (0..1 contract) > fraction 0 → zero face value; fraction 1 → full face value 0ms
```

0.55 → face 5500, `net_available_cents = -4000`; 0 → face 0; 1 → face 10000.

### AC3 — per-benefit and per-instance detail rows

```
✓ src/roi/compute.test.ts > AC3 — per-benefit and per-instance detail rows > carries period, face, and used per instance keyed by instanceKey 1ms
✓ src/roi/compute.test.ts > AC3 — per-benefit and per-instance detail rows > aggregates two in-window instances into one per-benefit row 0ms
```

Instance row carries `instance_key = instanceKey(benefit_id, period_start)`, period, `in_window`, face, used — enough to re-window without recomputation. Two in-window instances aggregate to one benefit row (face 20000, used 3000, `net_available_cents = 10500`).

### AC4 — window edges: no scaling

```
✓ src/roi/compute.test.ts > AC4 — window edges: no scaling of straddling or prorated instances > instance straddling the window start counts at full value 0ms
✓ src/roi/compute.test.ts > AC4 — window edges: no scaling of straddling or prorated instances > mid-year-opened prorated: true instance counts at full value 0ms
✓ src/roi/compute.test.ts > AC4 — window edges: no scaling of straddling or prorated instances > instance entirely before the window is excluded (in_window false) 0ms
```

Straddling (`2025-05-15..2025-06-15` vs window `2025-06-01..2026-06-01`) and `prorated: true` both count at full 10000; a fully-outside instance is `in_window: false`, face 0.

### AC5 — empty input, helpers-only arithmetic, contract intact

```
✓ src/roi/compute.test.ts > AC5 — empty input, helpers-only arithmetic, contract intact > no instances/usage: both nets are -fee, detail arrays empty 0ms
✓ src/roi/compute.test.ts > AC5 — empty input, helpers-only arithmetic, contract intact > window is [asOf - 12 months, asOf] via addMonths 0ms
```

Empty → `fee_cents = 9500`, `net_used_cents = net_available_cents = -9500`, empty detail arrays. `grep -n "Date" compute.ts` matches only the header comment ("never `Date`") — no `Date` construction anywhere.

### Full-suite runs (post-commit, on `factory/004-roi-overlap-rules-t5`)

```
pnpm -r test:
  packages/shared: Test Files 1 passed (1); Tests 1 passed (1)
  apps/web:       Test Files 1 passed (1); Tests 1 passed (1)
  apps/api:       Test Files 2 passed (2); Tests 10 passed (10)
  packages/catalog: Test Files 6 passed (6); Tests 47 passed (47)
  packages/rules:  Test Files 10 passed (10); Tests 73 passed (73)

pnpm -r lint:        packages/shared, apps/api, apps/catalog, apps/web, packages/rules — all "Done", exit 0
pnpm -r format:check: "All matched files use Prettier code style!" for catalog and rules; Done for api/web; exit 0
```

compute.test.ts summary line: `Tests  11 passed (11)` (see verbose lines above). Note: this branch's rules suite counts differ from the t1 branch's because it does not include the sibling t1 overlap contract (73 vs 82 tests) — expected, branches are independent.

## Notes

- Two-pass simplification done: removed two redundant `asOf` overrides in AC4 tests (BASE already pins `asOf: '2026-06-01'`); kept `faceValue` helper as the single documented scaling point. Tests/lint/format re-run clean after.
- No env vars introduced; no docs divergence — doc §3.9 unchanged. `RoiInputSchema`/`instanceKey` consumed as landed, never re-shaped.
- A sibling builder (t1) shares this working tree and switched branches mid-build; I restored `packages/rules/src/index.ts`, re-checked out my branch, and confirmed `git diff` contained only my 9-line export block before committing. My commit touches exactly 3 files, all mine.
