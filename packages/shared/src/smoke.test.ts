import { describe, expect, it } from 'vitest';
import { HealthStatus } from './index.js';

describe('@ccrt/shared', () => {
  it('exports a workspace-resolvable schema', () => {
    expect(HealthStatus.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });
});
