// Renewal anchor (doc §5.3, confirmed answer 2): one immediate instance at
// `open_date` (the free night fires on approval), then renewal-cycle periods
// anchored to `fee_date` — fallback chain `fee_date` → `anniversary_date` →
// `open_date`. The first cycle period starts at the first fee-date occurrence
// on/after max(open_date, effective_from).

import { addYears, compareISO, dayBefore, formatISO, parseISO } from '../dates.js';
import { buildInstances, type AnchorInput } from './shared.js';
import type { BenefitInstance } from '../result.js';

export interface RenewalInput extends AnchorInput {
  feeDate?: string;
  anniversaryDate?: string;
}

/** Generate renewal periods: immediate open_date instance + fee-date cycles. */
export function renewalInstances(input: RenewalInput): BenefitInstance[] {
  const { benefit, openDate, asOf } = input;
  const anchor = input.feeDate ?? input.anniversaryDate ?? openDate;
  const from =
    compareISO(openDate, benefit.effective_from) >= 0 ? openDate : benefit.effective_from;
  return buildInstances(input, renewalBounds(anchor, from, asOf));
}

function* renewalBounds(
  anchor: string,
  from: string,
  asOf: string,
): Generator<{ start: string; end: string }> {
  // Period 1: the immediate approval instance (always, even if the fee anchor
  // falls later — doc §5.3 "on approval"). When the first fee-anchored cycle
  // starts exactly at `from`, that year is already covered by the immediate
  // instance — no duplicate period.
  const firstCycle = firstOccurrenceOnOrAfter(anchor, from);
  const coincides = compareISO(firstCycle, from) === 0;
  if (compareISO(from, asOf) > 0) return;
  yield { start: from, end: dayBefore(coincides ? addYears(from, 1) : firstCycle) };

  let start = coincides ? addYears(firstCycle, 1) : firstCycle;
  for (;;) {
    if (compareISO(start, asOf) > 0) return;
    const next = addYears(start, 1);
    yield { start, end: dayBefore(next) };
    start = next;
  }
}

/** First occurrence of the anchor's month/day on/after `from`. */
function firstOccurrenceOnOrAfter(anchor: string, from: string): string {
  const [anchorYear, month, day] = parseISO(anchor);
  const [fromYear] = parseISO(from);
  const candidate = formatISO([Math.max(anchorYear, fromYear), month, day]);
  return compareISO(candidate, from) < 0 ? addYears(candidate, 1) : candidate;
}
