import { describe, expect, it } from 'vitest';
import { HealthStatus } from '@ccrt/shared';

describe('@ccrt/web', () => {
  it('resolves @ccrt/shared through the workspace', () => {
    expect(HealthStatus.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });
});
