import { Currency, Forex } from "../../db_schema";
import { Asset } from "../../db_schema/asset/asset";
import { AssetRepository } from "../../repositories/asset/asset.repository";
import { AssetDividendRepository } from "../../repositories/asset/asset.dividend.repository";
import { CurrenciesRepository } from "../../repositories/currencies.repository";
import { YahooFinanceService } from "../yahoo.finance.service";

const HISTORY_YEARS = 5;
const CHUNK_DELAY_MS = 100; // shorter delay — fire-and-forget background sync

export class StartupSyncService {
  private readonly assetRepository: AssetRepository;
  private readonly assetDividendRepository: AssetDividendRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly yahooFinanceService: YahooFinanceService;

  constructor() {
    this.assetRepository = new AssetRepository();
    this.assetDividendRepository = new AssetDividendRepository();
    this.currenciesRepository = new CurrenciesRepository();
    this.yahooFinanceService = new YahooFinanceService();
  }

  // Fire-and-forget: call this without awaiting
  public async syncAll(): Promise<void> {
    console.log("[StartupSync] Starting background sync...");
    await Promise.allSettled([
      this.syncForexRates(),
      this.syncDividends(),
    ]);
    console.log("[StartupSync] Background sync complete.");
  }

  // ─── FOREX SYNC ────────────────────────────────────────────────────────────

  private async syncForexRates(): Promise<void> {
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

  // ─── DIVIDEND SYNC ─────────────────────────────────────────────────────────

  private async syncDividends(): Promise<void> {
    try {
      const assets: Asset[] = await this.assetRepository.getAllAssets();
      const tickerAssets = assets.filter((a) => a.ticker_name != null && a.ticker_name.trim() !== "");

      if (tickerAssets.length === 0) return;

      await this.backfillHistoricalDividends(tickerAssets);
    }
    catch (err: unknown) {
      console.error("[StartupSync] syncDividends error:", err instanceof Error ? err.message : String(err));
    }
  }

  private async backfillHistoricalDividends(assets: Asset[]): Promise<void> {
    const assetIds = assets.map((a) => a.uuid);
    const oldestDates = await this.assetDividendRepository.getOldestDividendDatesByAssets(assetIds);

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - HISTORY_YEARS);
    fiveYearsAgo.setUTCHours(0, 0, 0, 0);

    const now = new Date();

    for (let i = 0; i < assets.length; i++) {
      if (i > 0) await this.yahooFinanceService.sleepMs(CHUNK_DELAY_MS);

      const asset = assets[i];
      const ticker = asset.ticker_name!;
      const oldest = oldestDates.get(asset.uuid);

      // Skip if we already have a complete 5yr history
      if (oldest && oldest <= fiveYearsAgo) continue;

      const from = fiveYearsAgo;
      const to = oldest ? new Date(oldest.getTime() - 24 * 60 * 60 * 1000) : now;
      if (from >= to) continue;

      try {
        const dividends = await this.yahooFinanceService.fetchHistoricalDividends(ticker, from, to);
        if (dividends.length === 0) continue;

        const records = dividends.map((row) => ({
          asset_uuid: asset.uuid,
          dividend_amount: row.dividends,
          ex_date: row.date,
        }));

        await this.assetDividendRepository.bulkCreate(records);
        console.log(`[StartupSync] Stored ${records.length} dividends for ${ticker}`);
      }
      catch (err) {
        console.error(`[StartupSync] dividend backfill error for ${ticker}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }
}
