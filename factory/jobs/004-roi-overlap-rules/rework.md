# Rework note — 2026-10-18

Retry the build. No new direction from the user; previous interruptions were
environment-level (agent output-cap / API crashes), not spec problems.

- The spec (spec.md) is unchanged and authoritative — continue from it.
- Already committed and intact on this branch: the ROI input contract
  (`packages/rules/src/roi/input.ts` + `input.test.ts`, AC7 matrix, commit
  98f4ab9). Keep it; do not rewrite unless defective.
- Remaining work: `computeCardRoi`, `detectOverlaps` (six §3.9 rules,
  time-aware Global Entry), tests for AC1–AC8, input-contract docs, green
  test/lint/format, de-bloat pass, then build.md with per-AC evidence.
- Work in small increments: many small commits, short tool outputs. Do not
  end the run without build.md on disk (or a BLOCKED: report in it).
