import { describe, expect, it } from 'vitest';
import { UserCardDatesSchema } from './user-card-dates.js';

describe('UserCardDatesSchema', () => {
  it('accepts open_date alone (anniversary/fee dates optional)', () => {
    const parsed = UserCardDatesSchema.parse({ open_date: '2026-03-10' });
    expect(parsed).toEqual({ open_date: '2026-03-10' });
  });

  it('accepts all three dates (refined-prompt goal 1: CSP anniversary input)', () => {
    expect(
      UserCardDatesSchema.parse({
        open_date: '2026-03-10',
        anniversary_date: '2026-03-10',
        fee_date: '2027-05-01',
      }),
    ).toMatchObject({ open_date: '2026-03-10', fee_date: '2027-05-01' });
  });

  it('rejects missing open_date (refined-prompt goal 9)', () => {
    expect(UserCardDatesSchema.safeParse({}).success).toBe(false);
    expect(UserCardDatesSchema.safeParse({ anniversary_date: '2026-03-10' }).success).toBe(false);
  });

  it('rejects malformed or impossible dates (refined-prompt goal 9)', () => {
    for (const bad of ['2026-3-10', '2026-02-30', 'not-a-date', '2026-13-01', '']) {
      expect(UserCardDatesSchema.safeParse({ open_date: bad }).success).toBe(false);
    }
  });

  it('rejects anniversary_date/fee_date before open_date', () => {
    expect(
      UserCardDatesSchema.safeParse({ open_date: '2026-03-10', anniversary_date: '2025-01-01' })
        .success,
    ).toBe(false);
    expect(
      UserCardDatesSchema.safeParse({ open_date: '2026-03-10', fee_date: '2026-03-09' }).success,
    ).toBe(false);
  });
});
