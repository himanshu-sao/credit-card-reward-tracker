import { CurrencySchema, type Currency } from './currency.js';

/**
 * Seed currencies (doc §3.6). default_cents_per_point is a conservative
 * baseline in integer cents per point; the ROI dashboard lets the user
 * override it per currency.
 */
export const currencies: Currency[] = CurrencySchema.array().parse([
  { id: 'membership-rewards', name: 'Membership Rewards', default_cents_per_point: 1 },
  { id: 'ultimate-rewards', name: 'Ultimate Rewards', default_cents_per_point: 1 },
  { id: 'hilton-honors', name: 'Hilton Honors', default_cents_per_point: 1 },
  { id: 'marriott-bonvoy', name: 'Marriott Bonvoy', default_cents_per_point: 1 },
  { id: 'bilt-points', name: 'Bilt Points', default_cents_per_point: 1 },
]);
