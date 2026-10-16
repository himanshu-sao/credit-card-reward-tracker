import { z } from 'zod';
import { StatusSchema } from '@ccrt/catalog';
import { isValidISO } from './dates.js';

const ISODate = z.string().refine(isValidISO, { message: 'must be a valid ISO date (YYYY-MM-DD)' });

/**
 * One reset period of a benefit (doc §6). `period_end` is inclusive
 * (23:59:59 local on that day); integer cents throughout.
 */
export const BenefitInstanceSchema = z.object({
  benefit_id: z.string().min(1),
  period_start: ISODate,
  period_end: ISODate,
  /** Allowance for this period in integer cents; null for non-monetary benefits. */
  amount_available_cents: z.number().int().nonnegative().nullable(),
  /** True when the card opened mid-period; amounts are NEVER scaled (doc §7). */
  prorated: z.boolean(),
  /** Mirrors the catalog status of the benefit at generation time. */
  status: StatusSchema,
});
export type BenefitInstance = z.infer<typeof BenefitInstanceSchema>;

/**
 * Engine result: either generated periods (possibly empty — e.g.
 * `effective_from` in the future) or an explicit "this anchor has no
 * periods" reason. Never a silent empty list for no-period anchors.
 */
export const GenerateResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('periods'), instances: z.array(BenefitInstanceSchema) }),
  z.object({ kind: z.literal('no_periods'), reason: z.string().min(1) }),
]);
export type GenerateResult = z.infer<typeof GenerateResultSchema>;

export function noPeriods(reason: string): GenerateResult {
  return { kind: 'no_periods', reason };
}
