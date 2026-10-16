// Calendar-grid anchors (doc §3.2): periods tile the calendar regardless of
// when the card opened. calendar_year: Jan 1–Dec 31; half_year: Jan–Jun /
// Jul–Dec; quarter: Jan/Mar/Jul/Oct starts; month: calendar months.

import {
  addMonths,
  compareISO,
  dayBefore,
  startOfHalfYear,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from '../dates.js';
import { buildInstances, type AnchorInput } from './shared.js';
import type { BenefitInstance } from '../result.js';

type CalendarAnchor = 'calendar_year' | 'half_year' | 'quarter' | 'month';

/** Grid-start function and step in months for each calendar anchor. */
const GRID: Record<CalendarAnchor, { start: (date: string) => string; stepMonths: number }> = {
  calendar_year: { start: startOfYear, stepMonths: 12 },
  half_year: { start: startOfHalfYear, stepMonths: 6 },
  quarter: { start: startOfQuarter, stepMonths: 3 },
  month: { start: startOfMonth, stepMonths: 1 },
};

/**
 * Generate periods for a calendar-grid anchor. Periods begin at the grid
 * start containing `open_date` (mid-period opening, flagged not scaled);
 * effective_from gating is end-based (a period is dropped only when it ends
 * before the benefit became effective — see buildInstances), so a period
 * straddling effective_from is kept, matching AC1.
 */
export function calendarInstances(
  input: AnchorInput & { anchor: CalendarAnchor },
): BenefitInstance[] {
  const grid = GRID[input.anchor];
  return buildInstances(input, gridBounds(grid.start, grid.stepMonths, input.openDate, input.asOf));
}

function* gridBounds(
  gridStart: (date: string) => string,
  step: number,
  from: string,
  asOf: string,
): Generator<{ start: string; end: string }> {
  let start = gridStart(from);
  for (;;) {
    const next = addMonths(start, step);
    yield { start, end: dayBefore(next) };
    if (compareISO(next, asOf) > 0) return;
    start = next;
  }
}
