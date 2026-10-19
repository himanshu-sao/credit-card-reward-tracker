// generateBenefitInstances: the reset engine's entry point (doc §6/§7).
// Zod-validates the input, then dispatches on the benefit's reset_anchor.
//
// Boundary conventions (doc §7, confirmed assumptions 3/9): period_end is
// inclusive at 23:59:59 local; a period exists once period_start <= as_of;
// as_of on a period_start starts the new period, as_of on a period_end keeps
// that period current (one-day safety margin). All dates are plain ISO
// strings — no timezone runtime code.

import { BenefitSchema } from '@ccrt/catalog';
import { z } from 'zod';
import { isValidISO } from './dates.js';
import { UserCardDatesSchema } from './user-card-dates.js';
import { GenerateResultSchema, type GenerateResult, type BenefitInstance } from './result.js';
import { calendarInstances } from './anchors/calendar.js';
import { anniversaryInstances } from './anchors/anniversary.js';
import { renewalInstances } from './anchors/renewal.js';
import { multiYearInstances } from './anchors/multi-year.js';
import { type AnchorInput } from './anchors/shared.js';

const AsOfSchema = z.string().refine(isValidISO, { message: 'asOf must be a valid ISO date' });

const GenerateInputSchema = z
  .object({
    benefit: BenefitSchema,
    cardDates: UserCardDatesSchema,
    asOf: AsOfSchema,
  })
  .refine((input) => input.asOf >= input.cardDates.open_date, {
    message: 'asOf must not be before the card open_date',
    path: ['asOf'],
  });

export type GenerateInput = z.infer<typeof GenerateInputSchema>;

/**
 * Generate every BenefitInstance period for one benefit, from the first
 * period start to `asOf` (history included, bounded by the 600-instance
 * guard). Non-periodic anchors return `{ kind: 'no_periods', reason }` —
 * never a silent empty list, never an exception (confirmed answer 3).
 * Throws a ZodError on malformed input (no partial output).
 */
export function generateBenefitInstances(input: GenerateInput): GenerateResult {
  const { benefit, cardDates, asOf } = GenerateInputSchema.parse(input);
  const anchorInput: AnchorInput = {
    benefit,
    openDate: cardDates.open_date,
    asOf,
  };

  switch (benefit.reset_anchor.type) {
    case 'calendar_year':
    case 'half_year':
    case 'quarter':
    case 'month':
      return periods(calendarInstances({ ...anchorInput, anchor: benefit.reset_anchor.type }));
    case 'anniversary':
      return periods(
        anniversaryInstances({
          ...anchorInput,
          anniversaryDate: cardDates.anniversary_date,
        }),
      );
    case 'renewal':
      return periods(
        renewalInstances({
          ...anchorInput,
          feeDate: cardDates.fee_date,
          anniversaryDate: cardDates.anniversary_date,
        }),
      );
    case 'multi_year':
      return periods(
        multiYearInstances({
          ...anchorInput,
          intervalYears: benefit.reset_anchor.interval_years,
        }),
      );
    case 'none':
      return noPeriodsFor('resets never (one-time benefit)');
    case 'ongoing':
      return noPeriodsFor('continuous benefit with no reset period');
    case 'per_stay':
      return noPeriodsFor('resets per stay — consumed by stay tracking, not periods');
    case 'per_purchase':
      return noPeriodsFor('resets per purchase — consumed by purchase tracking, not periods');
    case 'per_booking':
      return noPeriodsFor('resets per booking — consumed by booking tracking, not periods');
    case 'spend_threshold':
      return noPeriodsFor(
        'resets at a spend threshold — consumed by threshold tracking, not periods',
      );
  }
}

function periods(instances: BenefitInstance[]): GenerateResult {
  return GenerateResultSchema.parse({ kind: 'periods', instances });
}

function noPeriodsFor(reason: string): GenerateResult {
  return GenerateResultSchema.parse({ kind: 'no_periods', reason });
}
