import { Currency, Forex } from "../../db_schema";
import { Asset } from "../../db_schema/asset/asset";
import { YahooFinanceService } from "../yahoo.finance.service";
import { CurrenciesRepository } from "../../repositories";
import { AssetRepository } from "../../repositories/asset/asset.repository";
import { AssetPriceRepository } from "../../repositories/asset/asset_price.repository";

const HISTORY_YEARS = 5;
const CHUNK_DELAY_MS = 100; // shorter delay — fire-and-forget background sync

export class StartupSyncService {
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly assetRepository: AssetRepository;
  private readonly assetPriceRepository: AssetPriceRepository;
  private readonly yahooFinanceService: YahooFinanceService;

  constructor() {
    this.currenciesRepository = new CurrenciesRepository();
    this.assetRepository = new AssetRepository();
    this.assetPriceRepository = new AssetPriceRepository();
    this.yahooFinanceService = new YahooFinanceService();
  }

  // Fire-and-forget: call this without awaiting.
  // Dividends are fetched on-the-fly when a buy is added/edited/deleted.
  public async syncAll(): Promise<void> {
    console.log("[StartupSync] Starting background sync...");
    await Promise.all([
      this.syncForexRates(),
      this.syncPrices(),
    ]);
    console.log("[StartupSync] Background sync complete.");
  }

  // ─── PRICE SYNC ────────────────────────────────────────────────────────────

  private async syncPrices(): Promise<void> {
    try {
      const assets: Asset[] = await this.assetRepository.getAllAssets();
      const tickeredAssets = assets.filter((a) => !!a.ticker_name);
      if (tickeredAssets.length === 0) return;

      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - HISTORY_YEARS);
      fiveYearsAgo.setUTCHours(0, 0, 0, 0);
      const today = new Date();

      for (let i = 0; i < tickeredAssets.length; i++) {
        if (i > 0) await this.yahooFinanceService.sleepMs(CHUNK_DELAY_MS);

        const asset = tickeredAssets[i];
        const ticker = asset.ticker_name!;

        try {
          // Check both oldest and latest stored prices.
          // We need a backfill if the oldest stored date is more than 7 days after the
          // 5-year cutoff (meaning historical data is missing).
          // We need a recent update if the latest stored date is more than 2 days old.
          // This avoids the trap where a live-quote price stored for "today" causes the
          // sync to skip the entire 5-year historical range.
          const [oldestStored, latestStored] = await Promise.all([
            this.assetPriceRepository.getOldestPrice(asset.uuid),
            this.assetPriceRepository.getClosestPriceBeforeOrAt(asset.uuid, today),
          ]);
          const oldestDate = oldestStored
            ? new Date(String(oldestStored.asset_price_date).split("T")[0])
            : null;
          const latestDate = latestStored
            ? new Date(String(latestStored.asset_price_date).split("T")[0])
            : null;

          const backfillThreshold = new Date(fiveYearsAgo.getTime() + 7 * 24 * 60 * 60 * 1000);
          const needsBackfill = !oldestDate || oldestDate > backfillThreshold;
          const needsRecentUpdate = !latestDate ||
            (today.getTime() - latestDate.getTime()) > 2 * 24 * 60 * 60 * 1000;

          if (!needsBackfill && !needsRecentUpdate) continue;

          const from = needsBackfill
            ? fiveYearsAgo
            : new Date(latestDate!.getTime() + 24 * 60 * 60 * 1000);

          if (from > today) continue;

          console.log(`[StartupSync] Fetching prices for ${ticker} from ${from.toISOString().split("T")[0]}...`);
          const rows = await this.yahooFinanceService.fetchHistoricalData(ticker, from, today);
          if (rows.length === 0) {
            console.warn(`[StartupSync] No prices returned for ${ticker}`);
            continue;
          }

          await this.assetPriceRepository.bulkCreatePrices(
            rows.map((r) => ({
              asset_uuid:       asset.uuid,
              asset_price_date: r.date,
              asset_price:      r.price,
            }))
          );
          console.log(`[StartupSync] Stored ${rows.length} prices for ${ticker} (from ${from.toISOString().split("T")[0]})`);
        }
        catch (err) {
          console.error(`[StartupSync] Price sync error for ${ticker}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }
    catch (err) {
      console.error("[StartupSync] syncPrices error:", err instanceof Error ? err.message : String(err));
    }
  }

  // ─── FOREX SYNC ────────────────────────────────────────────────────────────

  private async syncForexRates(): Promise<void> {
    console.log("[StartupSync] Starting forex sync...");
    try {
      const currencies: Currency[] = await this.currenciesRepository.getAllCurrencies();
      if (currencies.length < 2) return;

      // Build N×(N-1) directional pairs and ensure they exist in DB
      const pairs: Forex[] = await this.ensureAllPairsExist(currencies);
      if (pairs.length === 0) return;

      await this.backfillHistoricalForexRates(currencies, pairs);
      await this.syncTodayForexRates(currencies, pairs);
    }
    catch (err: unknown) {
      console.error("[StartupSync] syncForexRates error:", err instanceof Error ? err.message : String(err));
    }
  }

  private async ensureAllPairsExist(currencies: Currency[]): Promise<Forex[]> {
    const pairs: Forex[] = [];
    for (const base of currencies) {
      for (const quote of currencies) {
        if (base.uuid === quote.uuid) continue;
        try {
          const pair = await this.currenciesRepository.addForexToDb(base.uuid, quote.uuid);
          pairs.push(pair);
        }
        catch (err) {
          console.error(`[StartupSync] ensureAllPairsExist error for ${base.currency_name}/${quote.currency_name}:`, err);
        }
        await this.yahooFinanceService.sleepMs(50);
      }
    }
    return pairs;
  }

  private async backfillHistoricalForexRates(currencies: Currency[], pairs: Forex[]): Promise<void> {
    const pairIds = pairs.map((p) => p.uuid);
    const oldestDates = await this.currenciesRepository.getOldestForexRateDatesByForexIds(pairIds);

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - HISTORY_YEARS);
    fiveYearsAgo.setUTCHours(0, 0, 0, 0);

    const pairsToBackfill = pairs.filter((pair) => {
      const oldest = oldestDates.get(pair.uuid);
      return !oldest || oldest > fiveYearsAgo;
    });

    if (pairsToBackfill.length === 0) return;

    const currencyMap = new Map(currencies.map((c) => [c.uuid, c.currency_name]));

    for (let i = 0; i < pairsToBackfill.length; i++) {
      if (i > 0) await this.yahooFinanceService.sleepMs(CHUNK_DELAY_MS);

      const pair = pairsToBackfill[i];
      const baseName = currencyMap.get(pair.base_currency);
      const quoteName = currencyMap.get(pair.quote_currency);
      if (!baseName || !quoteName) continue;

      const oldest = oldestDates.get(pair.uuid);
      const from = fiveYearsAgo;
      const to = oldest ? new Date(oldest.getTime() - 24 * 60 * 60 * 1000) : new Date();
      if (from >= to) continue;

      try {
        const ticker = `${baseName.toUpperCase()}${quoteName.toUpperCase()}=X`;
        const rates = await this.yahooFinanceService.fetchHistoricalData(ticker, from, to);
        if (rates.length === 0) continue;

        const records = rates.map((row) => ({
          forex_uuid: pair.uuid,
          forex_rate: row.price,
          forex_rate_date: row.date,
        }));

        await this.currenciesRepository.bulkCreateForexRates(records);
        console.log(`[StartupSync] Backfilled ${records.length} forex rates for ${baseName}/${quoteName}`);
      }
      catch (err) {
        console.error(`[StartupSync] backfill forex error for ${baseName}/${quoteName}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  private async syncTodayForexRates(currencies: Currency[], pairs: Forex[]): Promise<void> {
    const currencyMap = new Map(currencies.map((c) => [c.uuid, c.currency_name]));

    for (let i = 0; i < pairs.length; i++) {
      if (i > 0) await this.yahooFinanceService.sleepMs(CHUNK_DELAY_MS);

      const pair = pairs[i];
      const baseName = currencyMap.get(pair.base_currency);
      const quoteName = currencyMap.get(pair.quote_currency);
      if (!baseName || !quoteName) continue;

      try {
        const rate = await this.yahooFinanceService.getExchangeRate(baseName, quoteName);
        if (!rate || rate === 1) continue;

        const today = new Date();
        const existing = await this.currenciesRepository.getForexRateFromDb(pair, today);

        if (!existing) {
          await this.currenciesRepository.addForexRateToDb(pair, today, rate);
        }
      }
      catch (err) {
        console.error(`[StartupSync] syncToday forex error for ${baseName}/${quoteName}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

}
