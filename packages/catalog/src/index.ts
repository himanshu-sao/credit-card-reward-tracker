// The versioned benefit catalog: seed data, types, and validation.
// Placeholder for later jobs — no card data yet.

export type CatalogEntry = {
  /** Stable id, e.g. 'amex-platinum'. Real entries arrive in a later job. */
  id: string;
};

export const CATALOG_NAME = 'credit-card-benefit-catalog';
