import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();
const DATABASE_URL = process.env.DATABASE_URL as string;

export const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  define: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  timezone: "-00:00",
  dialectOptions: {
    timezone: "Z",
    dateStrings: true,
  },
  logging: false,
  pool: {
    max: 3,
    min: 0,
    acquire: 30000,
    idle: 5000,
  },
});

export async function startOfDatabase() {
  // sync({ force: false }) = CREATE TABLE IF NOT EXISTS only.
  // Does NOT inspect or alter existing columns — safe in prod, no connection spike.
  await sequelize
    .sync({ force: false })
    .then(() => {
      console.log("Database and tables have been synchronized");
    })
    .catch(err => {
      console.error("An error occurred while synchronizing the database:", err);
    });

  // Apply indexes that can't be added via sync({ force: false }) on existing tables.
  await ensureIndexes();
}

/**
 * Creates performance-critical indexes if they don't already exist.
 * Safe to call on every startup — IF NOT EXISTS prevents duplicate creation.
 * These indexes dramatically speed up dashboard and metrics calculations.
 */
export async function ensureIndexes(): Promise<void> {
  const indexes: Array<{ name: string; sql: string }> = [
    // AssetPrices: composite index for price lookups by asset + date (used by getLatestAssetPrice,
    // getAllPricesForAsset, getClosestPriceBeforeOrAt — called N times per metric calculation)
    {
      name: "idx_assetprices_asset_date",
      sql: `CREATE INDEX IF NOT EXISTS idx_assetprices_asset_date ON "AssetPrices" (asset_uuid, asset_price_date DESC)`,
    },
    // ForexRates: composite index for forex rate lookups by pair + date
    // (getClosestForexRateBeforeOrAt is called once per (currency, date) combination)
    {
      name: "idx_forexrates_forex_date",
      sql: `CREATE INDEX IF NOT EXISTS idx_forexrates_forex_date ON "ForexRates" (forex_uuid, forex_rate_date DESC)`,
    },
    // Forexes: index for looking up the forex pair UUID by base+quote currency
    {
      name: "idx_forexes_base_quote",
      sql: `CREATE INDEX IF NOT EXISTS idx_forexes_base_quote ON "Forexes" (base_currency, quote_currency)`,
    },
    // Transaction tables: index for getAllByPortfolioId queries
    {
      name: "idx_userassetbuys_portfolio",
      sql: `CREATE INDEX IF NOT EXISTS idx_userassetbuys_portfolio ON "UserAssetBuys" (portfolio_uuid)`,
    },
    {
      name: "idx_userassetsells_portfolio",
      sql: `CREATE INDEX IF NOT EXISTS idx_userassetsells_portfolio ON "UserAssetSells" (portfolio_uuid)`,
    },
    {
      name: "idx_userassetdividends_portfolio",
      sql: `CREATE INDEX IF NOT EXISTS idx_userassetdividends_portfolio ON "UserAssetDividends" (portfolio_uuid)`,
    },
  ];

  let created = 0;
  for (const { name, sql } of indexes) {
    try {
      await sequelize.query(sql);
      created++;
    } catch (err: any) {
      // Log but don't crash — index may already exist or table name may differ
      console.warn(`[ensureIndexes] Skipped "${name}": ${err?.message ?? err}`);
    }
  }
  if (created > 0) console.log(`[DB] ${created} index(es) ensured`);
}
