import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type Db = BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
};

export class DbError extends Error {}

export function createDb(databasePath: string): Db {
  let sqlite: Database.Database;
  try {
    sqlite = new Database(databasePath);
    sqlite.pragma('journal_mode = WAL');
  } catch (err) {
    // A corrupt/non-database file must fail fast with a message naming the
    // env var, not a stack trace (job 005 criterion 9).
    const code = (err as NodeJS.ErrnoException).code ?? '';
    const reason = code === 'SQLITE_NOTADB' ? 'file is not a database' : (err as Error).message;
    throw new DbError(
      `DATABASE_PATH: cannot open ${databasePath}: ${reason}. ` +
        'Delete the file (it holds only rebuildable local data) or point DATABASE_PATH at a valid SQLite file.',
    );
  }
  return drizzle(sqlite, { schema, logger: false }) as Db;
}

export { schema };
