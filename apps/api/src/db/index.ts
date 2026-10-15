import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type Db = BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
};

export function createDb(databasePath: string): Db {
  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema, logger: false }) as Db;
}

export { schema };
