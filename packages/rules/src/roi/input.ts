// ROI input contract (spec AC7/AC8; doc §3.9). The Phase-2 API adopts this
// schema verbatim: the card's fee and currency, its benefits, the reset
// engine's instances, per-instance usage, valuations, cents-per-point and
// points overrides, and `asOf`. All money is integer cents. Every cross-field
// rule AC7 requires is enforced here so `computeCardRoi` can trust its input
// without re-validating.

import { z } from 'zod';
import { StatusSchema } from '@ccrt/catalog';
import { isValidISO } from '../dates.js';
import { BenefitInstanceSchema, type BenefitInstance } from '../result.js';

const ISODate = z.string().refine(isValidISO, { message: 'must be a valid ISO date (YYYY-MM-DD)' });

/** Stable key for one instance of a benefit: `<benefit_id>:<period_start>`. */
export function instanceKey(benefitId: string, periodStart: string): string {
  return `${benefitId}:${periodStart}`;
}

/** Minimal card facts the ROI math needs (the full Card lives in @ccrt/catalog). */
const RoiCardSchema = z.object({
  id: z.string().min(1),
  annual_fee_cents: z.number().int().nonnegative(),
  currency_id: z.string().min(1),
});

/** Minimal benefit facts: face value, status, and retirement date. */
const RoiBenefitSchema = z.object({
  id: z.string().min(1),
  amount_cents: z.number().int().nonnegative().nullable(),
  status: StatusSchema,
  effective_to: ISODate.nullable().optional(),
});

export const RoiInputSchema = z
  .object({
    card: RoiCardSchema,
    /** benefit_id → benefit facts. */
    benefits: z.record(z.string(), RoiBenefitSchema),
    /** Instances from `generateBenefitInstances`. */
    instances: z.array(BenefitInstanceSchema),
    /** instance_key → cents used; capped at the instance allowance. */
    usage: z.record(z.string(), z.number().int().nonnegative()),
    /** benefit_id → realistic-value fraction of face value, 0..1 (default 1). */
    valuations: z.record(z.string(), z.number().min(0).max(1)),
    /** currency_id → cents-per-point override (default = catalog default). */
    cents_per_point: z.record(z.string(), z.number().positive()),
    /** benefit_id → points amount; only allowed for non-monetary benefits. */
    points_amounts: z.record(z.string(), z.number().int().positive()),
    /** Window anchor for the trailing-12-month ROI window. */
    asOf: ISODate,
  })
  .superRefine((input, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    const instancesByKey = new Map<string, BenefitInstance>();
    for (const inst of input.instances) {
      if (!(inst.benefit_id in input.benefits)) {
        fail('instances', `unknown benefit id ${inst.benefit_id}`);
      } else if (inst.period_start > inst.period_end) {
        fail('instances', `period_start after period_end for ${inst.benefit_id}`);
      } else {
        instancesByKey.set(instanceKey(inst.benefit_id, inst.period_start), inst);
      }
    }

    for (const [key, used] of Object.entries(input.usage)) {
      const inst = instancesByKey.get(key);
      if (!inst) {
        fail('usage', `unknown instance key ${key}`);
      } else if (used > (inst.amount_available_cents ?? 0)) {
        fail('usage', `usage ${used} exceeds cap ${inst.amount_available_cents ?? 0} for ${key}`);
      }
    }

    for (const field of ['valuations', 'points_amounts'] as const) {
      for (const id of Object.keys(input[field])) {
        if (!(id in input.benefits)) fail(field, `unknown benefit id ${id}`);
      }
    }

    for (const id of Object.keys(input.points_amounts)) {
      const benefit = input.benefits[id];
      if (benefit && benefit.amount_cents != null) {
        fail(
          'points_amounts',
          `benefit ${id} is monetary (amount_cents set); points amount not allowed`,
        );
      }
    }
  });

export type RoiInput = z.infer<typeof RoiInputSchema>;
