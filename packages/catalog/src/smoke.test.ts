import { describe, expect, it } from 'vitest';
import { CATALOG_NAME } from './index.js';

describe('@ccrt/catalog', () => {
  it('resolves @ccrt/shared through the workspace', async () => {
    const { HealthStatus } = await import('@ccrt/shared');
    expect(HealthStatus.parse({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(CATALOG_NAME).toBe('credit-card-benefit-catalog');
  });
});
