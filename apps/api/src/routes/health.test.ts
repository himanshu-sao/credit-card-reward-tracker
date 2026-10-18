import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../db/index.js';
import { migrateDb } from '../db/migrate.js';

// Unique temp SQLite file per run; removed on teardown.
const dir = mkdtempSync(path.join(tmpdir(), 'ccrt-api-'));
const dbPath = path.join(dir, `test-${process.pid}-${Date.now()}.db`);

let app: Awaited<ReturnType<typeof buildApp>>;
let db: ReturnType<typeof createDb>;

beforeAll(async () => {
  db = createDb(dbPath);
  migrateDb(db); // fresh temp file: migrations apply cleanly at boot time
  app = await buildApp(db);
});

afterAll(async () => {
  await app.close();
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /health', () => {
  it('returns 200 { status: "ok", db: "ok" } against a healthy db', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
  });

  it('returns a payload the shared schema validates', async () => {
    const { HealthStatus } = await import('@ccrt/shared');
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(() => HealthStatus.parse(res.json())).not.toThrow();
  });

  it('returns 503 degraded (never 500) when the db file is gone', async () => {
    rmSync(dbPath, { force: true }); // simulate the db file being removed
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'degraded', db: 'error' });
    // Restore for afterAll teardown.
    db = createDb(dbPath);
    migrateDb(db);
    expect(existsSync(dbPath)).toBe(true);
  });
});
