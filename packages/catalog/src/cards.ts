import { CardSchema, type Card } from './card.js';

/** Seed cards (doc §1.5). Fees in integer cents; total = 253500. */
export const cards: Card[] = CardSchema.array().parse([
  {
    id: 'chase-sapphire-preferred',
    issuer: 'Chase',
    name: 'Chase Sapphire Preferred',
    fee_cents: 9500,
    network: 'Visa',
    currency_id: 'ultimate-rewards',
  },
  {
    id: 'amex-platinum',
    issuer: 'American Express',
    name: 'The Platinum Card from American Express',
    fee_cents: 89500,
    network: 'American Express',
    currency_id: 'membership-rewards',
  },
  {
    id: 'hilton-amex-aspire',
    issuer: 'American Express',
    name: 'Hilton Honors American Express Aspire',
    fee_cents: 55000,
    network: 'American Express',
    currency_id: 'hilton-honors',
  },
  {
    id: 'hilton-amex-surpass',
    issuer: 'American Express',
    name: 'Hilton Honors American Express Surpass',
    fee_cents: 15000,
    network: 'American Express',
    currency_id: 'hilton-honors',
  },
  {
    id: 'bilt-palladium',
    issuer: 'Bilt',
    name: 'Bilt Palladium Card',
    fee_cents: 49500,
    network: 'Mastercard',
    currency_id: 'bilt-points',
  },
  {
    id: 'marriott-bonvoy-brilliant',
    issuer: 'American Express',
    name: 'Marriott Bonvoy Brilliant American Express',
    fee_cents: 65000,
    network: 'American Express',
    currency_id: 'marriott-bonvoy',
  },
]);
