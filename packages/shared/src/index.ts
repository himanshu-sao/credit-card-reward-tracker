import { z } from 'zod';

// Shared client/server types and Zod schemas. Placeholder for later jobs.

export const HealthStatus = z.object({
  status: z.literal('ok'),
});

export type HealthStatus = z.infer<typeof HealthStatus>;
