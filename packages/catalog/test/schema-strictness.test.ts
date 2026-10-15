import { describe, expect, it } from 'vitest';
import { BenefitSchema } from '../src/index.js';
import type { Benefit } from '../src/index.js';

const valid: Benefit = {
  id: 'test-benefit',
  card_id: 'test-card',
  name: 'Test benefit',
  category: 'travel',
  amount_cents: 10000,
  value_descriptor: '$100 per year',
  cadence: 'annually',
  reset_anchor: { type: 'anniversary' },
  rules: 'Test rules.',
  enrollment_required: false,
  status: 'active',
  effective_from: '2026-10-01',
  effective_to: null,
  source_url: 'https://example.com/card',
  last_verified_at: '2026-10-15',
  verification: 'confirmed',
};

const rejects = (label: string, row: Partial<Benefit>) => {
  it(`rejects ${label}`, () => {
    expect(BenefitSchema.safeParse({ ...valid, ...row }).success).toBe(false);
  });
};

describe('BenefitSchema strictness', () => {
  it('accepts a fully valid row', () => {
    expect(BenefitSchema.safeParse(valid).success).toBe(true);
  });
  rejects('an invalid status', { status: 'bogus' as Benefit['status'] });
  rejects('an invalid cadence', { cadence: 'whenever' as Benefit['cadence'] });
  rejects('an invalid reset_anchor type', {
    reset_anchor: { type: 'blue_moon' } as Benefit['reset_anchor'],
  });
  rejects('a missing source_url', { source_url: '' });
  rejects('a negative amount_cents', { amount_cents: -1 });
  rejects('a non-integer amount_cents', { amount_cents: 100.5 });
  rejects('a malformed effective_from', { effective_from: '2026/10/01' });
  rejects('a multi_year anchor missing interval_years', {
    reset_anchor: { type: 'multi_year' } as Benefit['reset_anchor'],
  });
  rejects('a spend_threshold anchor missing threshold_cents', {
    reset_anchor: { type: 'spend_threshold' } as Benefit['reset_anchor'],
  });
  rejects('an effective_from after effective_to', {
    effective_from: '2026-10-02',
    effective_to: '2026-10-01',
  });
  rejects('a verify row without a note', { verification: 'verify' });
  it('accepts amount_cents 0 and null', () => {
    expect(BenefitSchema.safeParse({ ...valid, amount_cents: 0 }).success).toBe(true);
    expect(
      BenefitSchema.safeParse({ ...valid, amount_cents: null, value_descriptor: 'Status' })
        .success,
    ).toBe(true);
  });
});
