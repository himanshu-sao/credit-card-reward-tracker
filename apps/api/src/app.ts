import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from './db/index.js';
import { healthRoutes } from './routes/health.js';

// Db is injected (not created here) so tests point at a temp SQLite file
// (job 005 spec).

export async function buildApp(db: Db): Promise<FastifyInstance & { db: Db }> {
  const app: FastifyInstance & { db: Db } = Object.assign(Fastify({ logger: false }), { db });
  await app.register(healthRoutes);
  return app;
}
