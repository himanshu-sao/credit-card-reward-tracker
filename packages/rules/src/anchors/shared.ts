// Shared period-generation core used by every period-producing anchor.
//
// Conventions (doc §7, spec edge cases 10/11): period_end is inclusive
// (23:59:59 local); a period is generated when period_start <= as_of; as_of ==
// period_start starts the new period. All comparisons are plain ISO dates —
// no timezone runtime code; the one-day safety margin is encoded in the
// inclusive period_end (see result.ts).

import type { Benefit } from '@ccrt/catalog';
import { compareISO, dayBefore } from '../dates.js';
import type { BenefitInstance } from '../result.js';

/** Refuse to generate more than this many periods for one benefit. */
export const MAX_PERIODS = 600;

/** Input every anchor helper receives after generate.ts has validated it. */
export interface AnchorInput {
  benefit: Benefit;
  openDate: string;
  asOf: string;
}

/**
 * Build instances from consecutive period bounds, where each bound's `end` is
 * the inclusive last day (normally the day before the next period starts).
 *
 * Applies the shared rules: effective_from/effective_to gating (a period
 * starting on effective_to survives via the inclusive end), retired = history
 * only (no forward periods, past preserved), mid-period opening (full amount
 * + `prorated: true`, never scaled), and the >MAX_PERIODS guard.
 */
export function buildInstances(
  input: AnchorInput,
  bounds: Iterable<{ start: string; end: string }>,
): BenefitInstance[] {
  const { benefit, openDate, asOf } = input;
  const instances: BenefitInstance[] = [];
  for (const { start, end } of bounds) {
    if (instances.length >= MAX_PERIODS) {
      throw new Error(
        `benefit ${benefit.id}: period generation exceeded the ${MAX_PERIODS}-instance guard ` +
          '(as_of too far from the anchor; refusing to continue)',
      );
    }
    // History only: a period starting after the benefit ended is never
    // generated; earlier periods stay (doc §7 retired benefits).
    if (benefit.effective_to && compareISO(start, benefit.effective_to) > 0) break;
    // A period that ended before the benefit became effective never existed.
    if (compareISO(end, benefit.effective_from) < 0) continue;
    // Only periods that have started by as_of are generated.
    if (compareISO(start, asOf) > 0) break;
    instances.push({
      benefit_id: benefit.id,
      period_start: start,
      period_end: end,
      amount_available_cents: benefit.amount_cents,
      // Mid-period opening: flag, never prorate (confirmed answer 1).
      prorated: compareISO(start, openDate) < 0,
      status: benefit.status,
    });
  }
  return instances;
}

/**
 * Pair a lazily-yielded sequence of consecutive period starts into inclusive
 * bounds: each period ends the day before the next one starts. The last
 * start in the stream must be a sentinel one past the final generated period.
 */
export function* withInclusiveEnds(
  starts: Iterable<string>,
): Generator<{ start: string; end: string }> {
  let prev: string | undefined;
  for (const start of starts) {
    if (prev !== undefined) yield { start: prev, end: dayBefore(start) };
    prev = start;
  }
}
