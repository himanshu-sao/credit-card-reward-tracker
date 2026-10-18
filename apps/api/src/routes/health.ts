import { existsSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';

export async function healthRoutes(app: FastifyInstance & { db: Db }): Promise<void> {
  app.get('/health', async (_req, reply) => {
    try {
      await app.db.run(sql`select 1`);
      // The boot-time handle keeps working after the file is removed (POSIX
      // unlink), and sqlite recreates on open, so probe the path itself:
      // a missing, unwritable, or corrupt db must surface here (job 005
      // criterion 4).
      const name = app.db.$client.name;
      if (name && name !== ':memory:' && name !== '') {
        if (!existsSync(name)) throw new Error(`db file missing: ${name}`);
        const probe = new Database(name, { readonly: true });
        try {
          probe.pragma('journal_mode'); // forces a real header read
        } finally {
          probe.close();
        }
      }
      return reply.code(200).send({ status: 'ok', db: 'ok' });
    } catch {
      // Never 500: the health check itself must not crash the process on a
      // broken db (job 005 criterion 4).
      return reply.code(503).send({ status: 'degraded', db: 'error' });
    }
  });
}
