import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_API_PORT, DEFAULT_DATABASE_PATH, loadConfig } from './config.js';

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tempDir() {
  const d = mkdtempSync(path.join(tmpdir(), 'ccrt-cfg-'));
  dirs.push(d);
  return d;
}

describe('loadConfig', () => {
  it('boots with no env at all: documented defaults, no crash', async () => {
    const cfg = await loadConfig({});
    expect(cfg.port).toBe(DEFAULT_API_PORT);
    expect(cfg.databasePath).toBe(DEFAULT_DATABASE_PATH);
  });

  it('honours DATABASE_PATH and creates a missing parent directory', async () => {
    const dbPath = path.join(tempDir(), 'nested', 'x.db');
    const cfg = await loadConfig({ DATABASE_PATH: dbPath });
    expect(cfg.databasePath).toBe(path.resolve(dbPath));
    expect(existsSync(path.dirname(dbPath))).toBe(true);
  });

  it('rejects a malformed port naming the var', async () => {
    await expect(loadConfig({ PORT: 'abc' })).rejects.toThrow(/PORT: must be a number or empty/);
  });

  it('rejects an out-of-range port naming the var', async () => {
    await expect(loadConfig({ API_PORT: '99999' })).rejects.toThrow(/API_PORT: must be <= 65535/);
  });

  it('treats an empty-string port as unset, applying the documented default', async () => {
    // `PORT=` in .env means unset — falls back to the default, no half-boot.
    const cfg = await loadConfig({ PORT: '' });
    expect(cfg.port).toBe(DEFAULT_API_PORT);
  });

  it('rejects setting both API_PORT and PORT with a readable error', async () => {
    await expect(loadConfig({ API_PORT: '4001', PORT: '4002' })).rejects.toThrow(
      /API_PORT and PORT are both set/,
    );
  });

  it('throws ConfigError, not an opaque better-sqlite3 trace, when the parent is a file', async () => {
    const file = path.join(tempDir(), 'plain-file');
    writeFileSync(file, 'x');
    await expect(loadConfig({ DATABASE_PATH: path.join(file, 'app.db') })).rejects.toThrow(
      ConfigError,
    );
  });
});
