import { sequelize } from "./db";

/**
 * Ensures all critical database indexes exist.
 *
 * Why this exists:
 *   Sequelize's sync({ force: false }) only runs CREATE TABLE IF NOT EXISTS.
 *   It never creates indexes that aren't defined on the model — and none of our
 *   models define any. Without these indexes, PostgreSQL does a full sequential
 *   scan on every query, regardless of how well the application code is parallelized.
 *
 *   AssetPrices alone has ~1.8M rows (990 assets × 5 years × ~365 days).
 *   A full scan on that table takes 200-500ms per query on the B1ms instance.
 *
 * How it works:
 *   Each statement uses CREATE INDEX CONCURRENTLY IF NOT EXISTS, which:
 *     - Is idempotent: safe to run on every restart, does nothing if index exists
 *     - Is non-blocking: PostgreSQL allows concurrent reads/writes while building
 *     - Is persistent: once built, the index survives restarts forever
 *
 *   The function is called fire-and-forget from app.ts so it never delays startup.
 *   After the first successful deploy, all subsequent startups skip instantly.
 */
export async function ensureIndexes(): Promise<void> {
  const indexes: Array<{ name: string; sql: string }> = [
    // ── AssetPrices ─────────────────────────────────────────────────────────
    // Used by: getClosestPricesBeforeOrAtBulk, getLatestAssetPrice,
    //          getClosestPriceBeforeOrAt, getOldestPrice
    // Without: full scan of ~1.8M rows per call (200-500ms each)
    // With:    index seek, <5ms
    {
      name: "idx_asset_prices_uuid_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asset_prices_uuid_date
            ON "AssetPrices" (asset_uuid, asset_price_date DESC)`,
    },

    // ── ForexRates ───────────────────────────────────────────────────────────
    // Used by: fetchRate() in metric.service.ts and portfolio.total.service.ts
    //          (every currency conversion lookup)
    {
      name: "idx_forex_rates_uuid_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forex_rates_uuid_date
            ON "ForexRates" (forex_uuid, forex_rate_date DESC)`,
    },

    // ── UserAssetBuys ────────────────────────────────────────────────────────
    // Used by: getAllByPortfolioId on every metrics/total request
    {
      name: "idx_user_asset_buys_portfolio",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_asset_buys_portfolio
            ON "UserAssetBuys" (portfolio_uuid)`,
    },

    // ── UserAssetSells ───────────────────────────────────────────────────────
    {
      name: "idx_user_asset_sells_portfolio",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_asset_sells_portfolio
            ON "UserAssetSells" (portfolio_uuid)`,
    },

    // ── UserAssetDividends ───────────────────────────────────────────────────
    {
      name: "idx_user_asset_dividends_portfolio",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_asset_dividends_portfolio
            ON "UserAssetDividends" (portfolio_uuid)`,
    },

    // ── Forexes ──────────────────────────────────────────────────────────────
    // Used by: fetchRate() to resolve a forex pair UUID from (base, quote)
    {
      name: "idx_forexes_base_quote",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forexes_base_quote
            ON "Forexes" (base_currency, quote_currency)`,
    },
  ];

  console.log("[Indexes] Building missing indexes in background...");

  for (const index of indexes) {
    try {
      await sequelize.query(index.sql);
      console.log(`[Indexes] ✓ ${index.name}`);
    } catch (err) {
      console.error(
        `[Indexes] ✗ ${index.name}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  console.log("[Indexes] Done.");
}
