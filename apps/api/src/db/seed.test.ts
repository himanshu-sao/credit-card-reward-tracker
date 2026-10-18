import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from './index.js';
import { migrateDb } from './migrate.js';
import { seed } from './seed.js';
import { Benefit, Card, CatalogChange, Currency, ThresholdTracker, UserCard } from './schema.js';
import { allBenefits, cards, currencies } from '@ccrt/catalog';

// Unique temp SQLite file per run; removed on teardown.
const dir = mkdtempSync(path.join(tmpdir(), 'ccrt-seed-'));
const dbPath = path.join(dir, `test-${process.pid}-${Date.now()}.db`);

let db: ReturnType<typeof createDb>;

beforeAll(() => {
  db = createDb(dbPath);
  migrateDb(db);
  seed(db);
});

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('db:seed', () => {
  // Criterion 2/5: counts derived from the catalog arrays, never hardcoded.
  it('seeds exactly the catalog cards, currencies, and benefits', () => {
    const cardRows = db.select().from(Card).all();
    const currencyRows = db.select().from(Currency).all();
    const benefitRows = db.select().from(Benefit).all();
    expect(cardRows).toHaveLength(cards.length);
    expect(currencyRows).toHaveLength(currencies.length);
    expect(benefitRows).toHaveLength(allBenefits.length);
  });

  it('has zero duplicate card/benefit ids', () => {
    const cardIds = db
      .select({ id: Card.id })
      .from(Card)
      .all()
      .map((r) => r.id);
    const benefitIds = db
      .select({ id: Benefit.id })
      .from(Benefit)
      .all()
      .map((r) => r.id);
    expect(new Set(cardIds).size).toBe(cardIds.length);
    expect(new Set(benefitIds).size).toBe(benefitIds.length);
  });

  // Criterion 3: re-seeding is idempotent.
  it('is idempotent: re-seeding yields identical counts, no duplicates', () => {
    seed(db);
    expect(db.select().from(Card).all()).toHaveLength(cards.length);
    expect(db.select().from(Benefit).all()).toHaveLength(allBenefits.length);
    const benefitIds = db
      .select({ id: Benefit.id })
      .from(Benefit)
      .all()
      .map((r) => r.id);
    expect(new Set(benefitIds).size).toBe(benefitIds.length);
  });

  // Criterion 8: upsert updates changed rows in place.
  it('updates a changed catalog row in place on re-seed', () => {
    const target = allBenefits[0];
    db.update(Benefit).set({ name: 'stale name' }).where(eq(Benefit.id, target.id)).run();
    seed(db);
    const row = db
      .select()
      .from(Benefit)
      .all()
      .find((r) => r.id === target.id);
    expect(row?.name).toBe(target.name);
  });

  // Criterion 3: CatalogChange exists but the seed never writes it.
  it('leaves CatalogChange empty', () => {
    expect(db.select().from(CatalogChange).all()).toHaveLength(0);
  });

  // Criterion 10: retired history is preserved.
  it('seeds retired benefits (history preserved, doc §7)', () => {
    const retired = db
      .select()
      .from(Benefit)
      .all()
      .filter((r) => r.status === 'retired');
    expect(retired.length).toBeGreaterThanOrEqual(1);
  });

  // Criterion 11: null amount_cents / effective_to round-trip.
  it('round-trips null amount_cents and effective_to without coercion', () => {
    const nullAmount = allBenefits.find((b) => b.amount_cents === null);
    const nullEnd = allBenefits.find((b) => b.effective_to === null);
    expect(nullAmount).toBeDefined();
    expect(nullEnd).toBeDefined();
    const amountRow = db
      .select()
      .from(Benefit)
      .all()
      .find((r) => r.id === nullAmount!.id);
    const endRow = db
      .select()
      .from(Benefit)
      .all()
      .find((r) => r.id === nullEnd!.id);
    expect(amountRow?.amount_cents).toBeNull();
    expect(endRow?.effective_to).toBeNull();
  });

  // Criterion 12: Verify-flagged rows keep their note.
  it('keeps notes on Verify-flagged rows through seed → read-back', () => {
    const verifyRows = allBenefits.filter((b) => b.verification === 'verify');
    expect(verifyRows.length).toBeGreaterThanOrEqual(1);
    for (const b of verifyRows) {
      const row = db
        .select()
        .from(Benefit)
        .all()
        .find((r) => r.id === b.id);
      expect(row?.note).toBe(b.note);
    }
  });

  // Criterion 15: user_id default and nullable benefit_id on ThresholdTracker.
  it('defaults user_id to local and inserts ThresholdTracker with null benefit_id', () => {
    const [card] = db.select().from(Card).limit(1).all();
    db.insert(UserCard)
      .values({ id: 'test-user-card', card_id: card.id, open_date: '2026-01-15' })
      .run();
    db.insert(ThresholdTracker)
      .values({
        id: 'test-threshold-tracker',
        user_card_id: 'test-user-card',
        benefit_id: null, // non-benefit trackers must be representable (answers Q1)
        calendar_year: '2026',
        threshold: 150000,
      })
      .run();
    const tracker = db
      .select()
      .from(ThresholdTracker)
      .where(eq(ThresholdTracker.id, 'test-threshold-tracker'))
      .all()[0];
    expect(tracker.user_id).toBe('local');
    expect(tracker.benefit_id).toBeNull();
  });
});
