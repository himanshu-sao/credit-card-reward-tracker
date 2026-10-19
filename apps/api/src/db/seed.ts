import { createDb } from './index.js';
import { loadConfig } from '../config.js';
import { Benefit, Card, Currency } from './schema.js';
import { migrateDb } from './migrate.js';
import { allBenefits, cards, currencies } from '@ccrt/catalog';

/**
 * Idempotent seed: loads @ccrt/catalog into the db via upsert by primary key.
 * Re-running updates changed rows in place and never duplicates (job 005
 * answers Q2 — silent re-seed). CatalogChange is written by feed logic in a
 * later job (doc §3.11), not by the seed.
 */
export function seed(db: ReturnType<typeof createDb>): void {
  db.transaction((tx) => {
    for (const currency of currencies) {
      tx.insert(Currency)
        .values({ ...currency })
        .onConflictDoUpdate({ target: Currency.id, set: { ...currency } })
        .run();
    }
    for (const card of cards) {
      // Card-level provenance (doc §3.2) derived from the card's benefits:
      // the newest last_verified_at and its source page.
      const cardBenefits = allBenefits.filter((b) => b.card_id === card.id);
      const newest = cardBenefits.reduce((a, b) =>
        a.last_verified_at > b.last_verified_at ? a : b,
      );
      const row = {
        ...card,
        source_url: newest.source_url,
        last_verified_at: newest.last_verified_at,
      };
      tx.insert(Card).values(row).onConflictDoUpdate({ target: Card.id, set: row }).run();
    }
    for (const benefit of allBenefits) {
      const row = {
        ...benefit,
        reset_anchor: JSON.stringify(benefit.reset_anchor),
      };
      tx.insert(Benefit).values(row).onConflictDoUpdate({ target: Benefit.id, set: row }).run();
    }
  });
}

/** CLI entrypoint: migrate to HEAD, then seed. Exits 0 on success. */
async function main() {
  const config = await loadConfig();
  const db = createDb(config.databasePath);
  try {
    migrateDb(db);
    seed(db);
    console.log(
      `Seeded ${cards.length} cards, ${currencies.length} currencies, ${allBenefits.length} benefits.`,
    );
  } finally {
    db.$client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
