import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../db/index.js';

// Unique temp SQLite file per run; removed on teardown.
const dir = mkdtempSync(path.join(tmpdir(), 'ccrt-api-'));
const dbPath = path.join(dir, `test-${process.pid}-${Date.now()}.db`);

let app: Awaited<ReturnType<typeof buildApp>>;
let db: ReturnType<typeof createDb>;

beforeAll(() => {
  db = createDb(dbPath); // proves the Drizzle/better-sqlite3 wiring against a temp file
});

afterAll(async () => {
  db.$client.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /health', () => {
  beforeAll(async () => {
    app = await buildApp();
  });

  it('returns 200 { status: "ok" }', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('returns a payload the shared schema validates', async () => {
    const { HealthStatus } = await import('@ccrt/shared');
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(() => HealthStatus.parse(res.json())).not.toThrow();
  });

  it('created the temp database file and tears it down', () => {
    expect(existsSync(dbPath)).toBe(true);
  });
});
