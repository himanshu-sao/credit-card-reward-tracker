// ROI core (doc §3.9; parent answers.md Q1/Q2). Trailing-12-month window,
// both net positions, realistic-value scaling. Consumes `RoiInputSchema`
// verbatim — every cross-field rule is already enforced there. Pure
// function; ISO strings via `src/dates.ts`, never `Date`.

import { z } from 'zod';
import { addMonths, compareISO } from '../dates.js';
import { instanceKey, type RoiInput } from './input.js';

export const BenefitRoiSchema = z.object({
  benefit_id: z.string().min(1),
  /** Face value inside the window, after valuation scaling (integer cents). */
  face_value_available_cents: z.number().int().nonnegative(),
  /** Realized value inside the window (integer cents). */
  value_used_cents: z.number().int().nonnegative(),
  /** True when an overlap warning flagged this benefit (doc §3.9). Annotation only. */
  redundant: z.boolean(),
});
export type BenefitRoi = z.infer<typeof BenefitRoiSchema>;

export const InstanceRoiSchema = z.object({
  instance_key: z.string().min(1),
  benefit_id: z.string().min(1),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  /** True when the instance's period overlaps the window (inclusive ends). */
  in_window: z.boolean(),
  /** Face value, never prorated even when `prorated: true` (doc §7). */
  face_value_cents: z.number().int().nonnegative(),
  value_used_cents: z.number().int().nonnegative(),
});
export type InstanceRoi = z.infer<typeof InstanceRoiSchema>;

export const CardRoiSchema = z.object({
  card_id: z.string().min(1),
  currency_id: z.string().min(1),
  fee_cents: z.number().int().nonnegative(),
  face_value_available_cents: z.number().int().nonnegative(),
  value_used_cents: z.number().int().nonnegative(),
  /** Realized net: value used minus fee (Q2). */
  net_used_cents: z.number().int(),
  /** Potential net: face value available minus fee (Q2). */
  net_available_cents: z.number().int(),
  window_start: z.string().min(1),
  window_end: z.string().min(1),
  benefits: z.array(BenefitRoiSchema),
  instances: z.array(InstanceRoiSchema),
});
export type CardRoi = z.infer<typeof CardRoiSchema>;

/** Realistic value scaling: valuation fraction (default 1) times face value. */
function faceValue(input: RoiInput, benefitId: string, amountCents: number): number {
  const fraction = input.valuations[benefitId] ?? 1;
  return Math.round(amountCents * fraction);
}

/**
 * Trailing-12-month ROI for one card (doc §3.9). An instance counts iff its
 * `[period_start, period_end]` overlaps `[asOf − 12 months, asOf]`
 * (inclusive ends), at full face value — never prorated. Non-monetary
 * benefits (null amount) contribute zero here; points face value is a
 * sibling sub-job's scope.
 */
export function computeCardRoi(input: RoiInput): CardRoi {
  const windowStart = addMonths(input.asOf, -12);
  const windowEnd = input.asOf;

  const benefits = new Map<string, { face: number; used: number }>();
  const instances: InstanceRoi[] = [];

  // Union of warned ids that exist on this card; unknown ids are dropped.
  const redundant = new Set<string>();
  for (const warning of input.overlap_warnings) {
    for (const id of warning.benefit_ids) {
      if (id in input.benefits) redundant.add(id);
    }
  }

  for (const inst of input.instances) {
    const key = instanceKey(inst.benefit_id, inst.period_start);
    const inWindow =
      compareISO(inst.period_end, windowStart) >= 0 &&
      compareISO(inst.period_start, windowEnd) <= 0;
    const face = inWindow ? faceValue(input, inst.benefit_id, inst.amount_available_cents ?? 0) : 0;
    const used = inWindow ? (input.usage[key] ?? 0) : 0;

    if (inWindow) {
      const totals = benefits.get(inst.benefit_id) ?? { face: 0, used: 0 };
      totals.face += face;
      totals.used += used;
      benefits.set(inst.benefit_id, totals);
    }
    instances.push({
      instance_key: key,
      benefit_id: inst.benefit_id,
      period_start: inst.period_start,
      period_end: inst.period_end,
      in_window: inWindow,
      face_value_cents: face,
      value_used_cents: used,
    });
  }

  let faceTotal = 0;
  let usedTotal = 0;
  const benefitRows = [...benefits.entries()].map(([id, totals]) => {
    faceTotal += totals.face;
    usedTotal += totals.used;
    return {
      benefit_id: id,
      face_value_available_cents: totals.face,
      value_used_cents: totals.used,
      redundant: redundant.has(id),
    };
  });

  // A flagged benefit with no in-window instances (e.g. a no_periods status
  // benefit like surpass-gold-status) still gets a zero-valued row to annotate.
  for (const id of redundant) {
    if (!benefits.has(id)) {
      benefitRows.push({
        benefit_id: id,
        face_value_available_cents: 0,
        value_used_cents: 0,
        redundant: true,
      });
    }
  }

  const fee = input.card.annual_fee_cents;
  return {
    card_id: input.card.id,
    currency_id: input.card.currency_id,
    fee_cents: fee,
    face_value_available_cents: faceTotal,
    value_used_cents: usedTotal,
    net_used_cents: usedTotal - fee,
    net_available_cents: faceTotal - fee,
    window_start: windowStart,
    window_end: windowEnd,
    benefits: benefitRows,
    instances,
  };
}
