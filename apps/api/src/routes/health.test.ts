import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../db/index.js';
import { migrateDb } from '../db/migrate.js';

const dir = mkdtempSync(path.join(tmpdir(), 'ccrt-api-'));

// Each degradation case is destructive, so every case builds its own app on
// its own db file and tears it down (job 005 criterion 4; round-1 review
// pinned that the old WAL-sidecar probe false-positived on the corrupt and
// unwritable cases).
async function withHealthApp(fn: (app: Awaited<ReturnType<typeof buildApp>>) => Promise<void>) {
  const file = `${dir}/case-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
  const db = createDb(file);
  migrateDb(db);
  const app = await buildApp(db);
  try {
    await fn(app);
  } finally {
    await app.close();
    db.$client.close();
    rmSync(file, { force: true });
    rmSync(`${file}-wal`, { force: true });
    rmSync(`${file}-shm`, { force: true });
  }
}

const degraded = { status: 'degraded', db: 'error' } as const;
const ok = { status: 'ok', db: 'ok' } as const;

// Shared healthy instance for the non-destructive assertions.
let app: Awaited<ReturnType<typeof buildApp>>;
let db: ReturnType<typeof createDb>;

beforeAll(async () => {
  const file = `${dir}/test-${process.pid}-${Date.now()}.db`;
  db = createDb(file);
  migrateDb(db);
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
    expect(res.json()).toEqual(ok);
  });

  it('returns a payload the shared schema validates', async () => {
    const { HealthStatus } = await import('@ccrt/shared');
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(() => HealthStatus.parse(res.json())).not.toThrow();
  });

  it('returns 503 degraded (never 500) when the db file is gone', async () => {
    await withHealthApp(async (app) => {
      rmSync(app.db.$client.name, { force: true }); // simulate the file being removed
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual(degraded);
    });
  });

  it('returns 503 degraded when the main db file is corrupt under a live server', async () => {
    await withHealthApp(async (app) => {
      // Garbage over the main file while the live handle and WAL sidecars
      // are open — the round-1 finding: the old probe read stale pages off
      // the -wal/-shm sidecars and reported 200.
      writeFileSync(app.db.$client.name, Buffer.alloc(4096, 0xff));
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual(degraded);
    });
  });

  it('returns 503 degraded when the db file is unreadable under a live server', async () => {
    await withHealthApp(async (app) => {
      // chmod-000: the live handle keeps serving its open fd, so only the
      // file probe catches it (round-1 reviewer's repro: old probe → 200).
      chmodSync(app.db.$client.name, 0o000);
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual(degraded);
    });
  });
});
