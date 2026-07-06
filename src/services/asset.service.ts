import { AssetRepository } from "../repositories/asset/asset.repository";
import { AssetPriceRepository } from "../repositories/asset/asset_price.repository";
import { AssetDividendRepository } from "../repositories/asset/asset.dividend.repository";
import { YahooFinanceService } from "./yahoo.finance.service";
import { AssetMapper } from "../mappers/asset.mapper";
import { AssetResponseDto } from "../dtos/asset/responses/asset.response.dto";
import { AssetPriceResponseDto } from "../dtos/asset/responses/asset.price.response.dto";
import { Asset } from "../db_schema/asset/asset";
import { AssetPrice } from "../db_schema/asset/asset_price";
import { CurrenciesRepository } from "../repositories";

export class AssetService {
  private readonly assetRepository: AssetRepository;
  private readonly assetPriceRepository: AssetPriceRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly assetDividendRepository: AssetDividendRepository;
  private readonly yahooFinanceService: YahooFinanceService;
  private readonly assetMapper: AssetMapper;

  constructor() {
    this.assetRepository = new AssetRepository();
    this.assetPriceRepository = new AssetPriceRepository();
    this.currenciesRepository = new CurrenciesRepository();
    this.assetDividendRepository = new AssetDividendRepository();
    this.yahooFinanceService = new YahooFinanceService();
    this.assetMapper = new AssetMapper();
  }

  public async getAllAssets(): Promise<AssetResponseDto[]> {
    const assets: Asset[] = await this.assetRepository.getAllAssets();
    return assets.map((a) => this.assetMapper.assetEntityToDto(a));
  }

  public async createCustomAsset(ticker: string): Promise<AssetResponseDto> {
    // Return existing if already saved (in assets table)
    const existing: Asset | null = await this.assetRepository.getAssetFromTicker(ticker);
    if (existing) {
      return this.assetMapper.assetEntityToDto(existing);
    }

    // Fetch from Yahoo Finance
    const quote = await this.yahooFinanceService.fetchAssetQuote(ticker);
    if (!quote) {
      throw new Error("TICKER_NOT_FOUND");
    }

    // Resolve currency UUID
    let currencyUuid: string | null = null;
    if (quote.currency) {
      const currency = await this.currenciesRepository.getByName(quote.currency);
      if (currency) {
        currencyUuid = currency.uuid;
      }
    }

    // Save directly in assets table (so FK constraints on AssetPrices/AssetDividends are satisfied)
    const asset: Asset = await this.assetRepository.addCustomAsset({
      ticker_name: quote.ticker,
      official_name: quote.officialName,
      base_currency_uuid: currencyUuid,
      asset_type: quote.assetType,
    });

    // Sync dividends SYNCHRONOUSLY — must be done before returning so that adding a buy
    // immediately after creating the asset already finds the dividend history in DB.
    await this.syncCustomAssetDividends(asset.uuid, quote.ticker);

    // Sync prices in background (many records, not needed immediately)
    this.syncCustomAssetPrices(asset.uuid, quote.ticker).catch((err) => {
      console.error(`[AssetService] Price sync failed for ${quote.ticker}:`, err instanceof Error ? err.message : String(err));
    });

    return this.assetMapper.assetEntityToDto(asset);
  }

  private async syncCustomAssetDividends(assetUuid: string, ticker: string): Promise<void> {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const now = new Date();

    try {
      const dividends = await this.yahooFinanceService.fetchHistoricalDividends(ticker, fiveYearsAgo, now);
      if (dividends.length > 0) {
        await this.assetDividendRepository.bulkCreate(
          dividends.map((d) => ({
            asset_uuid: assetUuid,
            dividend_amount: d.dividends,
            ex_date: d.date,
          }))
        );
        console.log(`[AssetService] Stored ${dividends.length} dividends for custom asset ${ticker}`);
      }
      else {
        console.log(`[AssetService] No dividends found for custom asset ${ticker}`);
      }
    }
    catch (err) {
      console.error(`[AssetService] Dividend sync failed for ${ticker}:`, err instanceof Error ? err.message : String(err));
    }
  }

  private async syncCustomAssetPrices(assetUuid: string, ticker: string): Promise<void> {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const now = new Date();

    try {
      const prices = await this.yahooFinanceService.fetchHistoricalData(ticker, fiveYearsAgo, now);
      if (prices.length > 0) {
        await this.assetPriceRepository.bulkCreatePrices(
          prices.map((p) => ({
            asset_uuid: assetUuid,
            asset_price_date: p.date,
            asset_price: p.price,
          }))
        );
        console.log(`[AssetService] Stored ${prices.length} prices for custom asset ${ticker}`);
      }
    }
    catch (err) {
      console.error(`[AssetService] Price sync failed for ${ticker}:`, err instanceof Error ? err.message : String(err));
    }
  }

  public async getAssetQuoteInfo(ticker: string): Promise<{
    ticker: string;
    officialName: string | null;
    currency: string | null;
    price: number | null;
    assetType: string | null;
  } | null> {
    return this.yahooFinanceService.fetchAssetQuote(ticker);
  }

  public async getAssetPrice(assetId: string, date: string): Promise<AssetPriceResponseDto | null> {
    const asset: Asset | null = await this.assetRepository.getAssetFromUUID(assetId);
    if (!asset) throw new Error("ASSET_NOT_FOUND");

    const targetDate: Date = new Date(date);

    // 1. Try DB first
    const assetPrice: AssetPrice | null = await this.assetPriceRepository.getClosestPriceBeforeOrAt(assetId, targetDate);

    // Only trust the DB price if it falls within 7 days before the target date.
    // A price stored further back is likely the only record in DB (e.g., a stale
    // live-quote cached for a different date) and would return the same wrong value
    // for all subsequent dates that fall after it.
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const priceIsCloseEnough = assetPrice != null &&
      (targetDate.getTime() - new Date(assetPrice.asset_price_date).getTime()) <= SEVEN_DAYS_MS;

    if (priceIsCloseEnough) {
      return {
        price: assetPrice!.asset_price,
        date:  new Date(assetPrice!.asset_price_date).toISOString().split("T")[0],
      };
    }

    // 2. Not in DB or too stale — fetch historical price from Yahoo Finance for this date.
    //    Look back up to 7 days to handle weekends / market holidays.
    if (asset.ticker_name) {
      const lookbackStart = new Date(targetDate);
      lookbackStart.setDate(lookbackStart.getDate() - 7);
      // Add 1 day to period2 so Yahoo includes targetDate itself
      const periodEnd = new Date(targetDate);
      periodEnd.setDate(periodEnd.getDate() + 1);

      const rows = await this.yahooFinanceService.fetchHistoricalData(asset.ticker_name, lookbackStart, periodEnd);
      if (rows.length > 0) {
        // Take the closest row at or before targetDate
        const closest = rows
          .filter((r) => r.date <= targetDate)
          .sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? rows[rows.length - 1];

        // Cache in DB so future requests for this specific date are instant
        await this.assetPriceRepository.bulkCreatePrices([{
          asset_uuid:       assetId,
          asset_price_date: closest.date,
          asset_price:      closest.price,
        }]).catch(() => { /* ignore duplicate key errors */ });

        return {
          price: closest.price,
          date:  closest.date.toISOString().split("T")[0],
        };
      }

      // 3. No historical data at all → fall back to live quote (new/illiquid assets)
      const quote = await this.yahooFinanceService.fetchAssetQuote(asset.ticker_name);
      if (!quote || quote.price == null) return null;
      return {
        price: quote.price,
        date:  new Date().toISOString().split("T")[0],
      };
    }

    if (!assetPrice) return null;
    return {
      price: assetPrice.asset_price,
      date:  new Date(assetPrice.asset_price_date).toISOString().split("T")[0],
    };
  }

}
