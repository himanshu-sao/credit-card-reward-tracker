import { z } from 'zod';
import { isValidISO } from './dates.js';

// Dates-only projection of a user's card (doc §6). The API job lifts this
// into `UserCard`; the reset engine consumes only these three dates.

const ISODate = z.string().refine(isValidISO, { message: 'must be a valid ISO date (YYYY-MM-DD)' });

export const UserCardDatesSchema = z
  .object({
    /** Date the card account was approved/opened. Always present. */
    open_date: ISODate,
    /** Anniversary anchor if the user re-set it (may differ from open_date). */
    anniversary_date: ISODate.optional(),
    /** Date the annual fee posts; drives `renewal` anchors. */
    fee_date: ISODate.optional(),
  })
  .refine((d) => !d.anniversary_date || d.anniversary_date >= d.open_date, {
    message: 'anniversary_date must not be before open_date',
    path: ['anniversary_date'],
  })
  .refine((d) => !d.fee_date || d.fee_date >= d.open_date, {
    message: 'fee_date must not be before open_date',
    path: ['fee_date'],
  });

export type UserCardDates = z.infer<typeof UserCardDatesSchema>;
