// Overlap input contract: goals 1–5 + edge cases (refined prompt), asserted
// against the decided semantics (unknown ids pass; strict YYYY-MM-DD).

import { describe, expect, it } from 'vitest';
import { OverlapInputSchema } from './input.js';

const BASE = {
  wallet: ['csp', 'amex-brilliant'],
  asOf: '2026-06-01',
  last_ge_application_date: '2025-11-15',
} as const;

const valid = (over: Record<string, unknown>) => OverlapInputSchema.parse({ ...BASE, ...over });

describe('OverlapInputSchema — valid inputs', () => {
  it('parses a wallet with unique ids and both dates', () => {
    expect(valid({})).toEqual(BASE);
  });

  it('parses an empty wallet', () => {
    expect(valid({ wallet: [] }).wallet).toEqual([]);
  });

  it('parses a missing last_ge_application_date', () => {
    const parsed = OverlapInputSchema.parse({ wallet: BASE.wallet, asOf: BASE.asOf });
    expect(parsed).toEqual({ wallet: BASE.wallet, asOf: BASE.asOf });
  });

  it('parses a one-id wallet (no minimum-size rule)', () => {
    expect(valid({ wallet: ['csp'] }).wallet).toEqual(['csp']);
  });

  it('passes unknown catalog card ids (t2 registry owns firing)', () => {
    expect(valid({ wallet: ['ghost-card'] }).wallet).toEqual(['ghost-card']);
  });
});

describe('OverlapInputSchema — rejections', () => {
  it('rejects duplicate card ids', () => {
    expect(() => valid({ wallet: ['csp', 'csp'] })).toThrow(/duplicate card id csp/);
  });

  it('rejects non-adjacent duplicates too', () => {
    expect(() => valid({ wallet: ['csp', 'amex-brilliant', 'csp'] })).toThrow(
      /duplicate card id csp/,
    );
  });

  it('rejects empty card ids', () => {
    expect(() => valid({ wallet: [''] })).toThrow(/too_small|at least 1/);
  });

  it('rejects malformed dates with time components (strict YYYY-MM-DD)', () => {
    expect(() => valid({ asOf: '2026-13-45' })).toThrow(/ISO date/);
    expect(() => valid({ last_ge_application_date: '2026-13-45' })).toThrow(/ISO date/);
    expect(() => valid({ asOf: '2026-07-31T00:00:00Z' })).toThrow(/ISO date/);
    expect(() => valid({ last_ge_application_date: '2026-07-31T00:00:00Z' })).toThrow(/ISO date/);
  });
});
