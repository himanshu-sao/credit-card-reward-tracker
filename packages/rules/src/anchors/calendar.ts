// Calendar-grid anchors (doc §3.2): periods tile the calendar regardless of
// when the card opened. calendar_year: Jan 1–Dec 31; half_year: Jan–Jun /
// Jul–Dec; quarter: Jan/Mar/Jul/Oct starts; month: calendar months.

import {
  addMonths,
  compareISO,
  startOfHalfYear,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from '../dates.js';
import { buildInstances, withInclusiveEnds, type AnchorInput } from './shared.js';
import type { BenefitInstance } from '../result.js';

type GridStart = (date: string) => string;

const GRID: Record<'calendar_year' | 'half_year' | 'quarter' | 'month', GridStart> = {
  calendar_year: startOfYear,
  half_year: startOfHalfYear,
  quarter: startOfQuarter,
  month: startOfMonth,
};

/**
 * Generate periods for a calendar-grid anchor. Periods begin at the grid
 * start containing `open_date`; effective_from gating is end-based (a period
 * is dropped only when it ends before the benefit became effective — see
 * buildInstances), so a period straddling effective_from is kept, matching
 * AC1. Mid-year opening flags the first period `prorated` with the full
 * amount (confirmed answer 1).
 */
export function calendarInstances(
  input: AnchorInput & { anchor: 'calendar_year' | 'half_year' | 'quarter' | 'month' },
): BenefitInstance[] {
  const gridStart = GRID[input.anchor];
  // Step length in months between grid starts.
  const step = { calendar_year: 12, half_year: 6, quarter: 3, month: 1 }[input.anchor];
  return buildInstances(
    input,
    withInclusiveEnds(lazyGridStarts(gridStart, step, input.openDate, input.asOf)),
  );
}

function* lazyGridStarts(
  gridStart: GridStart,
  step: number,
  from: string,
  asOf: string,
): Generator<string> {
  let start = gridStart(from);
  // Grid starts strictly before `from` are skipped: the first period is the
  // one containing `from` (mid-period opening, flagged not scaled).
  for (;;) {
    yield start;
    const next = addMonths(start, step);
    if (compareISO(next, asOf) > 0) {
      // Sentinel one past the last generated period, so its end is set.
      yield next;
      return;
    }
    start = next;
  }
}
