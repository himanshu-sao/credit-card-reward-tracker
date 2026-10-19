import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Data model per feature doc §6. Conventions (job 005 spec):
// - money is integer cents, never floats
// - dates are ISO 'YYYY-MM-DD' text
// - structured values (reset anchors, rules, payload pairs) are JSON text,
//   validated by Zod on read (packages/catalog schemas) — the db trusts text
// - user_id defaults to 'local' (single-user MVP, no auth; profile Notes)
// - no column anywhere may hold a full card number or CVV; UserCard.last_four
//   is display-only text(4) (doc §3.10)

export const USER_ID_DEFAULT = 'local';

/** A reward currency tracked by the ROI dashboard (doc §6, §3.6). */
export const Currency = sqliteTable('currency', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Default valuation in integer cents per point (user-overridable later). */
  default_cents_per_point: integer('default_cents_per_point').notNull(),
});

/** A credit card in the catalog (doc §6). */
export const Card = sqliteTable('card', {
  id: text('id').primaryKey(),
  issuer: text('issuer').notNull(),
  name: text('name').notNull(),
  /** Annual fee in integer cents. */
  fee_cents: integer('fee_cents').notNull(),
  network: text('network').notNull(),
  /** FK → Currency.id; seeded from the catalog. */
  currency_id: text('currency_id')
    .notNull()
    .references(() => Currency.id),
  /** Provenance (doc §3.2), derived from the card's catalog benefits. */
  source_url: text('source_url').notNull(),
  last_verified_at: text('last_verified_at').notNull(),
});

/**
 * A catalog benefit row (doc §6). Versioned: rows are superseded, never
 * edited in place — effective_from/effective_to/status carry the versioning
 * rule from §6/§7.
 */
export const Benefit = sqliteTable(
  'benefit',
  {
    id: text('id').primaryKey(),
    card_id: text('card_id')
      .notNull()
      .references(() => Card.id),
    name: text('name').notNull(),
    category: text('category').notNull(),
    /** Face value in integer cents; null for non-monetary benefits. */
    amount_cents: integer('amount_cents'),
    /** Describes non-monetary value (e.g. 'Status') when amount_cents is null. */
    value_descriptor: text('value_descriptor').notNull(),
    /** Human-readable cadence, kept in sync with reset_anchor. */
    cadence: text('cadence').notNull(),
    /** JSON text — ResetAnchor from @ccrt/catalog (validated on read). */
    reset_anchor: text('reset_anchor').notNull(),
    /** Eligible merchants, minimums, portal requirements. */
    rules: text('rules').notNull(),
    enrollment_required: integer('enrollment_required', { mode: 'boolean' }).notNull(),
    /** active | changed | retired | grandfathered. */
    status: text('status').notNull(),
    effective_from: text('effective_from').notNull(),
    effective_to: text('effective_to'),
    source_url: text('source_url').notNull(),
    last_verified_at: text('last_verified_at').notNull(),
    /** confirmed | verify. */
    verification: text('verification').notNull(),
    /** Required by the catalog schema whenever verification === 'verify'. */
    note: text('note'),
  },
  (table) => [index('benefit_card_idx').on(table.card_id)],
);

/** A card the user actually holds (doc §6). */
export const UserCard = sqliteTable('user_card', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().default(USER_ID_DEFAULT),
  card_id: text('card_id')
    .notNull()
    .references(() => Card.id),
  open_date: text('open_date').notNull(),
  anniversary_date: text('anniversary_date'),
  fee_date: text('fee_date'),
  nickname: text('nickname'),
  is_authorized_user: integer('is_authorized_user', { mode: 'boolean' }).notNull().default(false),
  /** P1 (account linking, doc §3.4) — nullable now, no endpoint uses it. */
  linked_account_id: text('linked_account_id'),
  /** Display-only last four; never a full card number or CVV (doc §3.10). */
  last_four: text('last_four', { length: 4 }),
});

/** One generated allowance period for a benefit on a user's card (doc §6). */
export const BenefitInstance = sqliteTable(
  'benefit_instance',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().default(USER_ID_DEFAULT),
    user_card_id: text('user_card_id')
      .notNull()
      .references(() => UserCard.id),
    benefit_id: text('benefit_id')
      .notNull()
      .references(() => Benefit.id),
    period_start: text('period_start').notNull(),
    period_end: text('period_end').notNull(),
    /** Integer cents. */
    amount_available: integer('amount_available').notNull(),
    amount_used: integer('amount_used').notNull().default(0),
    status: text('status').notNull(),
    expiry_notified_at: text('expiry_notified_at'),
  },
  (table) => [
    index('benefit_instance_user_card_idx').on(table.user_card_id),
    index('benefit_instance_benefit_idx').on(table.benefit_id),
  ],
);

/** A use of a benefit allowance (doc §6). */
export const UsageEvent = sqliteTable(
  'usage_event',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().default(USER_ID_DEFAULT),
    benefit_instance_id: text('benefit_instance_id')
      .notNull()
      .references(() => BenefitInstance.id),
    /** Integer cents. */
    amount: integer('amount').notNull(),
    date: text('date').notNull(),
    /** manual | auto | imported. */
    source: text('source').notNull(),
    transaction_id: text('transaction_id'),
    /** Auto-match confidence, 0–100; null for manual entries. */
    confidence: integer('confidence'),
  },
  (table) => [index('usage_event_instance_idx').on(table.benefit_instance_id)],
);

/** A card transaction, from linked accounts or import (doc §6, P1). */
export const Transaction = sqliteTable('transaction', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().default(USER_ID_DEFAULT),
  /** P1 — nullable now, no endpoint uses it. */
  account_id: text('account_id'),
  date: text('date').notNull(),
  /** Integer cents. */
  amount: integer('amount').notNull(),
  merchant: text('merchant'),
  category: text('category'),
  raw_description: text('raw_description'),
});

/** Annual-spend threshold progress (doc §6). */
export const ThresholdTracker = sqliteTable(
  'threshold_tracker',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().default(USER_ID_DEFAULT),
    user_card_id: text('user_card_id')
      .notNull()
      .references(() => UserCard.id),
    /** Nullable: non-benefit trackers (Marriott Elite Night Credits, Bilt Cash). */
    benefit_id: text('benefit_id').references(() => Benefit.id),
    calendar_year: text('calendar_year').notNull(),
    /** Integer cents spent toward the threshold so far. */
    spend_to_date: integer('spend_to_date').notNull().default(0),
    /** Threshold in integer cents. */
    threshold: integer('threshold').notNull(),
    awarded_at: text('awarded_at'),
  },
  (table) => [index('threshold_tracker_user_card_idx').on(table.user_card_id)],
);

/** A scheduled reminder for a benefit instance (doc §6). */
export const Reminder = sqliteTable(
  'reminder',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().default(USER_ID_DEFAULT),
    benefit_instance_id: text('benefit_instance_id')
      .notNull()
      .references(() => BenefitInstance.id),
    send_at: text('send_at').notNull(),
    /** push | email (doc §8: offline-safe channels). */
    channel: text('channel').notNull(),
    /** pending | sent | dismissed. */
    state: text('state').notNull(),
  },
  (table) => [index('reminder_instance_idx').on(table.benefit_instance_id)],
);

/** User's point valuation override (doc §6, §3.6). */
export const UserValuation = sqliteTable(
  'user_valuation',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().default(USER_ID_DEFAULT),
    /** Exactly one of benefit_id / currency_id is set (app-enforced). */
    benefit_id: text('benefit_id').references(() => Benefit.id),
    currency_id: text('currency_id').references(() => Currency.id),
    /** Percentage value retained, basis points (value_pct * 100); null when using cents_per_point. */
    value_pct_bp: integer('value_pct_bp'),
    /** Integer cents per point; null when using value_pct. */
    cents_per_point: integer('cents_per_point'),
  },
  (table) => [
    uniqueIndex('user_valuation_unique').on(table.user_id, table.benefit_id, table.currency_id),
  ],
);

/** Benefits that interact — mutually exclusive / redundant / shared limit (doc §6). */
export const OverlapRule = sqliteTable('overlap_rule', {
  id: text('id').primaryKey(),
  /** JSON text — array of Benefit ids (validated on read). */
  benefit_ids: text('benefit_ids').notNull(),
  /** mutually_exclusive | redundant | shared_limit. */
  rule_type: text('rule_type').notNull(),
  message: text('message').notNull(),
});

/** Catalog change feed row (doc §6, §3.11 — written by a later job). */
export const CatalogChange = sqliteTable(
  'catalog_change',
  {
    id: text('id').primaryKey(),
    benefit_id: text('benefit_id')
      .notNull()
      .references(() => Benefit.id),
    /** added | changed | retired. */
    change_type: text('change_type').notNull(),
    /** JSON text — the row before the change. */
    before: text('before'),
    /** JSON text — the row after the change. */
    after: text('after'),
    effective_date: text('effective_date').notNull(),
    source_url: text('source_url'),
    reviewed_by: text('reviewed_by'),
  },
  (table) => [index('catalog_change_benefit_idx').on(table.benefit_id)],
);
