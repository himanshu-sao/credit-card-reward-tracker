import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Placeholder table proving the Drizzle wiring. The real data model
// (feature doc §6) lands in a later job and replaces this file's contents.

export const placeholder = sqliteTable('placeholder', {
  id: text('id').primaryKey(),
});
