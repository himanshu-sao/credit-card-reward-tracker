// Loads the repo-root .env (if present) so the documented contract holds:
// PORT (and any other shared vars) in the root .env apply to the web dev
// server, just like they do to the API. Real environment variables always
// win — dotenv never overrides what's already set.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rootEnv = path.resolve(pkgRoot, '../../.env');

if (existsSync(rootEnv)) {
  const { config } = await import('dotenv');
  config({ path: rootEnv, quiet: true });
}

const nextBin = path.join(pkgRoot, 'node_modules/.bin/next');
const child = spawn(nextBin, ['dev'], { cwd: pkgRoot, env: process.env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
