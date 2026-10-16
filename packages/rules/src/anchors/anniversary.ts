// Anniversary anchor (doc §3.2): periods run month/day-of-anniversary to
// next-anniversary-minus-one-day. Anchor date is `anniversary_date` when the
// user re-set it, else the card's `open_date` (confirmed answer 5). Leap-day
// anniversaries roll to Feb 28 in non-leap years via addYears clamping.

import { addYears, compareISO, dayBefore, parseISO, formatISO } from '../dates.js';
import { buildInstances, type AnchorInput } from './shared.js';
import type { BenefitInstance } from '../result.js';

/** Generate anniversary-year periods for the benefit. */
export function anniversaryInstances(
  input: AnchorInput & { anniversaryDate?: string },
): BenefitInstance[] {
  const anchorDate = input.anniversaryDate ?? input.openDate;
  // Periods run anniversary-to-anniversary from the card's own dates;
  // effective_from gating is end-based in buildInstances (a straddling
  // period is kept, per spec AC1).
  return buildInstances(input, anniversaryBounds(anchorDate, input.openDate, input.asOf));
}

function* anniversaryBounds(
  anchorDate: string,
  from: string,
  asOf: string,
): Generator<{ start: string; end: string }> {
  // First period starts at the first anniversary occurrence on/after `from`
  // (confirmed answer 5); if the anchor date itself is on/after `from`, the
  // period starting that day is first (may be mid-period vs open → prorated).
  const year = firstOccurrenceYear(anchorDate, from);
  let start = occurrenceOn(anchorDate, year);
  for (;;) {
    if (compareISO(start, asOf) > 0) return;
    const next = addYears(start, 1);
    yield { start, end: dayBefore(next) };
    start = next;
  }
}

/** Year of the first anchor occurrence on/after `from`. */
function firstOccurrenceYear(anchorDate: string, from: string): number {
  const [anchorYear] = parseISO(anchorDate);
  const [fromYear] = parseISO(from);
  // Walk forward from the later of the anchor's own year and `from`'s year.
  let year = Math.max(anchorYear, fromYear);
  if (compareISO(occurrenceOn(anchorDate, year), from) < 0) year++;
  return year;
}

/** The anniversary occurring in `year`, Feb 29 clamped to Feb 28 off-leap. */
function occurrenceOn(anchorDate: string, year: number): string {
  const [, month, day] = parseISO(anchorDate);
  return formatISO([year, month, day]);
}
