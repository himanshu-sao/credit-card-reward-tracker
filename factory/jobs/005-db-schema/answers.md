# Answers — 005-db-schema

1. **Q1 — ThresholdTracker.benefit_id**: Nullable. Non-benefit trackers (Marriott
   Elite Night Credits, Bilt Cash balance/expiry) must be representable.
2. **Q2 — Re-seed behavior**: Silent upsert. Changed catalog rows update in
   place; CatalogChange feed logic (doc §3.11) is a later job — the table
   exists now, nothing writes it in this job.
3. **Q3 — Migrations at boot**: Apply pending migrations at API boot; dev
   servers and tests never run against an unmigrated db.
4. **Q4 — Single-user default**: Confirmed. `user_id='local'` is the default,
   populated by schema/defaults; no auth added now.
5. **All remaining OPEN assumptions (1, 4–8) confirmed as written**: seed loads
   currencies (5 rows) alongside cards and benefits; ISO `YYYY-MM-DD` text
   dates and integer-cent money columns, no floats; JSON text columns for
   anchor/rules/benefit_ids/before-after payloads validated by Zod on read;
   P1-only columns (`linked_account_id`, `Transaction.account_id`,
   `UserCard.last_four` text(4)) present as nullable now, no endpoint accepts
   them yet, and no column anywhere can hold a card number or CVV; generated
   migration SQL committed under `apps/api/drizzle/`; `/health` returns 200
   `{"status":"ok","db":"ok"}` on success and 503
   `{"status":"degraded","db":"error"}` on db failure, never a 500.
