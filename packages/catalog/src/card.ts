import { z } from 'zod';

/** A credit card in the catalog (doc §1.5, §6). */
export const CardSchema = z.object({
  /** Stable id, e.g. 'chase-sapphire-preferred'. */
  id: z.string().min(1),
  issuer: z.string().min(1),
  name: z.string().min(1),
  /** Annual fee in integer cents (no dollar floats). */
  fee_cents: z.number().int().nonnegative(),
  network: z.string().min(1),
  /** Reward currency this card earns; must resolve to a seeded Currency. */
  currency_id: z.string().min(1),
});

export type Card = z.infer<typeof CardSchema>;
