import { z } from 'zod';

// Shared client/server types and Zod schemas.

/** GET /health payload: ok when the db ping succeeds, degraded otherwise. */
export const HealthStatus = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), db: z.literal('ok') }),
  z.object({ status: z.literal('degraded'), db: z.literal('error') }),
]);

export type HealthStatus = z.infer<typeof HealthStatus>;
