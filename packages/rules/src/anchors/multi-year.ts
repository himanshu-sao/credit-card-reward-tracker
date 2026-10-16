// multi_year anchor (doc §3.2, confirmed answer 4): generic multi-year
// periods anchored to the card's open-date anniversary, stepping
// `interval_years` at a time. The engine trusts `interval_years` whatever it
// is (1 degenerates to annual); interval_years <= 0 is rejected upstream by
// the catalog's ResetAnchorSchema, never by the engine. The catalog's
// every_4_years cadence-label fix is a job-002 backlog item, out of scope.

import { addYears, compareISO, dayBefore } from '../dates.js';
import { buildInstances, type AnchorInput } from './shared.js';
import type { BenefitInstance } from '../result.js';

/** Generate multi-year periods anchored at the card's open date. */
export function multiYearInstances(
  input: AnchorInput & { intervalYears: number },
): BenefitInstance[] {
  return buildInstances(input, multiYearBounds(input));
}

function* multiYearBounds(input: AnchorInput & { intervalYears: number }) {
  let start = input.openDate;
  for (;;) {
    const next = addYears(start, input.intervalYears);
    yield { start, end: dayBefore(next) };
    if (compareISO(next, input.asOf) > 0) return;
    start = next;
  }
}
