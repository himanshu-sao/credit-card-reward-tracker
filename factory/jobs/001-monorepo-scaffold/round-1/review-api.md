VERDICT: PASS

- `DATABASE_PATH=<tmp>/test.db API_PORT=8799 pnpm --filter @ccrt/api start` (no `.env` present); `curl http://127.0.0.1:8799/health` → `{"status":"ok"}` HTTP 200; override db file created (4096 bytes) at the temp path.
- Nonexistent parent: `DATABASE_PATH=<tmp>/deep/nested/cols/test.db API_PORT=8798` → boots, `/health` 200, `deep/nested/cols/` created with `test.db` — matches build.md.
- Port in use: second instance on 8799 → exit 1, stderr `API_PORT: port 8799 is already in use.` — matches build.md.
- No-env default boot (no `DATABASE_PATH`/`API_PORT`): `/health` on default port 4000 → 200; `apps/api/.data/app.db` created as documented (README/`.env.example` agree: DATABASE_PATH `apps/api/.data/app.db`, API_PORT 4000, PORT 3000).
- `curl http://127.0.0.1:8799/nope` → 404 `{"message":"Route GET:/nope not found",...}` — sane JSON 404, no hang. All test servers killed; no processes or temp dirs left.
