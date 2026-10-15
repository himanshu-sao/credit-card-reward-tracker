import { z } from 'zod';

/** A reward currency tracked by the ROI dashboard (doc §3.6). */
export const CurrencySchema = z.object({
  /** Stable id, e.g. 'membership-rewards'. */
  id: z.string().min(1),
  /** Program name, e.g. 'Membership Rewards'. */
  name: z.string().min(1),
  /** Default valuation in integer cents per point (user-overridable later). */
  default_cents_per_point: z.number().int().positive(),
});

export type Currency = z.infer<typeof CurrencySchema>;
