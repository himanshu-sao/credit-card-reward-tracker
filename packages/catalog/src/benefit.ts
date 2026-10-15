import { z } from 'zod';

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');

/** Human-readable cadence, kept in sync with the structured reset_anchor. */
export const CadenceSchema = z.enum([
  'none',
  'ongoing',
  'monthly',
  'quarterly',
  'semi_annually',
  'annually',
  'every_4_years',
  'per_stay',
  'per_purchase',
  'per_booking',
]);
export type Cadence = z.infer<typeof CadenceSchema>;

/** When the benefit's allowance resets. Most anchors carry no extra data. */
export const ResetAnchorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('calendar_year') }),
  z.object({ type: z.literal('half_year') }),
  z.object({ type: z.literal('quarter') }),
  z.object({ type: z.literal('month') }),
  z.object({ type: z.literal('anniversary') }),
  z.object({ type: z.literal('renewal') }),
  z.object({ type: z.literal('ongoing') }),
  z.object({ type: z.literal('per_stay') }),
  z.object({ type: z.literal('per_purchase') }),
  z.object({ type: z.literal('per_booking') }),
  z.object({ type: z.literal('multi_year'), interval_years: z.number().int().positive() }),
  z.object({ type: z.literal('spend_threshold'), threshold_cents: z.number().int().positive() }),
]);
export type ResetAnchor = z.infer<typeof ResetAnchorSchema>;

export const StatusSchema = z.enum(['active', 'changed', 'retired', 'grandfathered']);
export type Status = z.infer<typeof StatusSchema>;

export const VerificationSchema = z.enum(['confirmed', 'verify']);
export type Verification = z.infer<typeof VerificationSchema>;

/** A single benefit row (doc §5/§6). Monetary amounts are integer cents. */
export const BenefitSchema = z
  .object({
    /** Stable id, e.g. 'csp-hotel-credit'. */
    id: z.string().min(1),
    card_id: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    /** Face value in integer cents; null for non-monetary benefits. */
    amount_cents: z.number().int().nonnegative().nullable(),
    /** Describes non-monetary value (e.g. 'Status') when amount_cents is null. */
    value_descriptor: z.string(),
    cadence: CadenceSchema,
    reset_anchor: ResetAnchorSchema,
    /** Eligible merchants, minimums, portal requirements. */
    rules: z.string(),
    enrollment_required: z.boolean(),
    status: StatusSchema,
    effective_from: DateString,
    effective_to: DateString.nullable(),
    /** Issuer's official card page URL. */
    source_url: z.url(),
    last_verified_at: DateString,
    verification: VerificationSchema,
    /** Required whenever verification === 'verify'. */
    note: z.string().optional(),
  })
  .superRefine((row, ctx) => {
    if (row.effective_to && row.effective_from > row.effective_to) {
      ctx.addIssue({
        code: 'custom',
        path: ['effective_from'],
        message: 'effective_from must not be after effective_to',
      });
    }
    if (row.verification === 'verify' && (!row.note || row.note.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'verification "verify" requires a note explaining what to verify',
      });
    }
  });

export type Benefit = z.infer<typeof BenefitSchema>;
