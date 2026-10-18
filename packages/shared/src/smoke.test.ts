import { describe, expect, it } from 'vitest';
import { HealthStatus } from './index.js';

describe('@ccrt/shared', () => {
  it('validates the healthy payload', () => {
    expect(HealthStatus.parse({ status: 'ok', db: 'ok' })).toEqual({ status: 'ok', db: 'ok' });
  });

  it('validates the degraded payload', () => {
    expect(HealthStatus.parse({ status: 'degraded', db: 'error' })).toEqual({
      status: 'degraded',
      db: 'error',
    });
  });

  it('rejects mismatched pairs', () => {
    expect(() => HealthStatus.parse({ status: 'ok', db: 'error' })).toThrow();
  });
});
