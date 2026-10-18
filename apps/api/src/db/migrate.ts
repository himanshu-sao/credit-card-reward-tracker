import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './index.js';

// The committed SQL migrations under apps/api/drizzle/ — applied at boot
// (server.ts) and by db:seed, so a fresh DATABASE_PATH is never unmigrated
// (job 005 answers Q3).

const migrationsFolder = path.resolve(import.meta.dirname, '../../drizzle');

/** Applies all pending migrations; a no-op when the db is already at HEAD. */
export function migrateDb(db: Db): void {
  migrate(db, { migrationsFolder });
}
