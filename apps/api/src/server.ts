import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { migrateDb } from './db/migrate.js';
import { buildApp } from './app.js';

const config = await loadConfig();
// Migrations run before buildApp so the db schema is at HEAD before the port
// opens; a fresh DATABASE_PATH needs no manual step (job 005 answers Q3).
const db = createDb(config.databasePath);
migrateDb(db);
const app = await buildApp(db);

try {
  await app.listen({ port: config.port, host: '127.0.0.1' });
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(`API_PORT: port ${config.port} is already in use.`);
  } else {
    console.error('Failed to start API:', err);
  }
  process.exit(1);
}

const shutdown = async () => {
  await app.close();
  db.$client.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
