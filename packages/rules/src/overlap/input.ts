// Overlap input contract (doc §3.9). Single input shape every overlap rule
// (t2–t4) consumes: the wallet's catalog card ids, `asOf`, and the optional
// GE-rule anchor date. Decided semantics: unknown catalog card ids PASS this
// schema — t2's catalog registry owns firing — and dates are strict
// `YYYY-MM-DD` (`2026-07-31T00:00:00Z` rejects, per `src/dates.ts`).

import { z } from 'zod';
import { isValidISO } from '../dates.js';

const ISODate = z.string().refine(isValidISO, { message: 'must be a valid ISO date (YYYY-MM-DD)' });

export const OverlapInputSchema = z
  .object({
    /** Catalog card ids in the wallet; empty allowed (detection yields nothing). */
    wallet: z.array(z.string().min(1)),
    /** Window anchor for overlap detection. */
    asOf: ISODate,
    /** Doc §3.9 GE rule anchor; when absent the GE rule never fires. */
    last_ge_application_date: ISODate.optional(),
  })
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    for (const id of input.wallet) {
      if (seen.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['wallet'], message: `duplicate card id ${id}` });
      }
      seen.add(id);
    }
  });

export type OverlapInput = z.infer<typeof OverlapInputSchema>;
