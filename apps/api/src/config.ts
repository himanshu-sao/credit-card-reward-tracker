import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const DEFAULT_DATABASE_PATH = path.resolve(import.meta.dirname, '../.data/app.db');
export const DEFAULT_API_PORT = 4000;

const portSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+$/.test(v), 'must be a number or empty')
  .refine((v) => v === '' || Number(v) >= 1, 'must be >= 1')
  .refine((v) => v === '' || Number(v) <= 65535, 'must be <= 65535')
  .transform((v) => (v === '' ? undefined : Number(v)));

const envSchema = z.object({
  DATABASE_PATH: z.string().trim().optional(),
  // API_PORT wins when both are set (a root .env serving web + API sets
  // PORT for the web client and API_PORT for this service).
  API_PORT: portSchema.optional(),
  PORT: portSchema.optional(),
});

export type AppConfig = {
  databasePath: string;
  port: number;
};

export class ConfigError extends Error {}

/**
 * Validates env vars, failing fast with a message naming the offending var.
 * Loads the root `.env` (gitignored) if present; boots fine without it.
 */
export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<AppConfig> {
  if (env === process.env) {
    await loadDotEnv(); // real env vars always win; dotenv never overrides them
  }

  const parsed = envSchema.safeParse({
    DATABASE_PATH: env.DATABASE_PATH,
    API_PORT: env.API_PORT,
    PORT: env.PORT,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const name = issue.path.join('.') || 'environment';
    throw new ConfigError(`Invalid or conflicting config: ${name}: ${issue.message}`);
  }

  const databasePath = parsed.data.DATABASE_PATH
    ? path.resolve(parsed.data.DATABASE_PATH)
    : DEFAULT_DATABASE_PATH;

  const parent = path.dirname(databasePath);
  try {
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    if (!statSync(parent).isDirectory()) {
      throw new Error('parent exists but is not a directory');
    }
  } catch (err) {
    throw new ConfigError(
      `DATABASE_PATH: cannot create parent directory ${parent}: ${(err as Error).message}`,
    );
  }

  const port = parsed.data.API_PORT ?? parsed.data.PORT ?? DEFAULT_API_PORT;
  return { databasePath, port };
}

async function loadDotEnv() {
  // Optional .env at the repo root — the API must boot without it.
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });
  } catch {
    // unreadable .env — fall through to defaults
  }
}
