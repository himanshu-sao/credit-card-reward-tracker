import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { buildApp } from './app.js';

const config = await loadConfig();
// Opening the db here proves DATABASE_PATH is writable before the port opens.
const db = createDb(config.databasePath);
const app = await buildApp();

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
