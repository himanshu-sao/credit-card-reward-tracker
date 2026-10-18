import { existsSync, openSync, readSync, closeSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';

const SQLITE_MAGIC = 'SQLite format 3\u0000';

export async function healthRoutes(app: FastifyInstance & { db: Db }): Promise<void> {
  app.get('/health', async (_req, reply) => {
    try {
      await app.db.run(sql`select 1`);
      // The boot-time handle keeps working after the file is removed (POSIX
      // unlink), and an open WAL db serves committed pages from the -wal
      // sidecar, so reopening the file still sees sidecar content. Only
      // reading the main file's own header bytes cannot be fooled by the
      // sidecars: a missing, unreadable, or corrupt db surfaces here
      // (job 005 criterion 4).
      const name = app.db.$client.name;
      if (name && name !== ':memory:' && name !== '') {
        if (!existsSync(name)) throw new Error(`db file missing: ${name}`);
        const fd = openSync(name, 'r');
        try {
          const header = Buffer.alloc(16);
          const bytes = readSync(fd, header, 0, 16, 0);
          if (bytes < 16 || header.toString('latin1') !== SQLITE_MAGIC) {
            throw new Error(`db file is not a SQLite database: ${name}`);
          }
        } finally {
          closeSync(fd);
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
