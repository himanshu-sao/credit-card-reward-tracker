# Answers to the refiner's open questions — round 1

1. source_url: yes — one URL per card (the issuer's official card/benefit
   page), not per-benefit URLs. `last_verified_at` = 2026-10-15 (doc
   compile date, per §13) as guessed.
2. effective_from for undated rows: proceed with the guess —
   `effective_from` = 2026-10-01, `effective_to` = null.
3. Amex Platinum earning cap: yes — leave the cap out of structured
   fields; record the doc's "annual cap per sources" wording in the note.
4. CLEAR+ amount: proceed with the guess — `amount_cents` = 20900
   ($209), with the $189–$219 range recorded in the note.

All other assumptions confirmed as stated.
