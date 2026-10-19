// ROI core (doc §3.9; parent answers.md Q1/Q2, assumptions 5/6).
// Trailing-12-month window, both net positions, realistic-value scaling,
// points face value, retired-benefit exclusion. Consumes `RoiInputSchema`
// verbatim — every cross-field rule is already enforced there. Pure
// function; ISO strings via `src/dates.ts`, never `Date`.

import { currencies } from '@ccrt/catalog';
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
  /** True when an in-window instance was skipped by the retired rule (assumption 6). */
  excluded_retired: z.boolean(),
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

/**
 * Own-property lookup on a string-keyed input record: an id like `__proto__`
 * or `constructor` is schema-valid, so bare bracket access would resolve
 * through the prototype chain and defeat the `??` fallbacks — never a number.
 */
function ownEntry<V>(record: Record<string, V>, key: string): V | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** Realistic value scaling: valuation fraction (default 1) times face value. */
function scaleValue(input: RoiInput, benefitId: string, amountCents: number): number {
  const fraction = ownEntry(input.valuations, benefitId) ?? 1;
  return Math.round(amountCents * fraction);
}

/**
 * Face value for one instance (assumption 5): monetary benefits use
 * `amount_cents` as today; a non-monetary benefit with a `points_amounts`
 * entry converts at `cents_per_point[currency_id]` (override) or the catalog
 * default for that currency; no points entry → zero.
 */
function faceValueFor(
  input: RoiInput,
  benefitId: string,
  amountAvailableCents: number | null,
): number {
  if (amountAvailableCents != null) return amountAvailableCents;
  const points = ownEntry(input.points_amounts, benefitId);
  if (points == null) return 0;
  const defaultCents =
    currencies.find((c) => c.id === input.card.currency_id)?.default_cents_per_point ?? 0;
  const centsPerPoint = ownEntry(input.cents_per_point, input.card.currency_id) ?? defaultCents;
  return Math.round(points * centsPerPoint);
}

/**
 * Trailing-12-month ROI for one card (doc §3.9). An instance counts iff its
 * `[period_start, period_end]` overlaps `[asOf − 12 months, asOf]`
 * (inclusive ends), at full face value — never prorated. A retired benefit's
 * instance counts only when `period_start <= effective_to` (assumption 6);
 * excluded instances keep their row, flagged `excluded_retired`, at zero.
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
    const benefit = input.benefits[inst.benefit_id];
    // Retired rule: history in, forward out — a period starting after the
    // benefit's effective_to never counts.
    const excludedRetired =
      inWindow &&
      benefit?.status === 'retired' &&
      benefit.effective_to != null &&
      compareISO(inst.period_start, benefit.effective_to) > 0;
    const counted = inWindow && !excludedRetired;
    const face = counted
      ? scaleValue(
          input,
          inst.benefit_id,
          faceValueFor(input, inst.benefit_id, inst.amount_available_cents),
        )
      : 0;
    const used = counted ? (input.usage[key] ?? 0) : 0;

    if (counted) {
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
      excluded_retired: excludedRetired,
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
