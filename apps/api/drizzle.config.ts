import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

// Same contract as the API: DATABASE_PATH env var with the documented
// default of apps/api/.data/app.db.
const here = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DATABASE_PATH ?? path.resolve(here, '.data/app.db');

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databasePath,
  },
});
