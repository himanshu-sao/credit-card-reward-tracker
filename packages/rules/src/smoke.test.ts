import { describe, expect, it } from 'vitest';
import { RULES_ENGINE_NAME } from './index.js';

describe('@ccrt/rules', () => {
  it('resolves @ccrt/shared through the workspace', async () => {
    const { HealthStatus } = await import('@ccrt/shared');
    expect(HealthStatus.parse({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(RULES_ENGINE_NAME).toBe('reset-cadence-engine');
  });
});
