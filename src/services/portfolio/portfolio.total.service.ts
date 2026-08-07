import { Asset, Currency } from "../../db_schema";
import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { PortfolioRepository } from "../../repositories/portfolio/portfolio.repository";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user.asset.buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user.asset.sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user.asset.dividend.repository";
import { AssetPriceRepository } from "../../repositories/asset/asset_price.repository";
import { AssetRepository } from "../../repositories/asset/asset.repository";
import { PortfolioTotalResponseDto } from "../../dtos/portfolio/responses/portfolio.total.response.dto";
import { CurrenciesRepository } from "../../repositories";
import { YahooFinanceService } from "../yahoo.finance.service";

export class PortfolioTotalService {
  private readonly portfolioRepository: PortfolioRepository;
  private readonly userAssetBuyRepository: UserAssetBuyRepository;
  private readonly userAssetSellRepository: UserAssetSellRepository;
  private readonly userAssetDividendRepository: UserAssetDividendRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly assetPriceRepository: AssetPriceRepository;
  private readonly assetRepository: AssetRepository;
  private readonly yahooFinanceService: YahooFinanceService;

  // Promise-based cache: concurrent callers for the same (currency, date) key share
  // one DB round-trip instead of each firing their own query (stampede prevention).
  private rateCache: Map<string, Promise<number>> = new Map();

  constructor() {
    this.portfolioRepository = new PortfolioRepository();
    this.userAssetBuyRepository = new UserAssetBuyRepository();
    this.userAssetSellRepository = new UserAssetSellRepository();
    this.userAssetDividendRepository = new UserAssetDividendRepository();
    this.currenciesRepository = new CurrenciesRepository();
    this.assetPriceRepository = new AssetPriceRepository();
    this.assetRepository = new AssetRepository();
    this.yahooFinanceService = new YahooFinanceService();
  }

  public async getPortfolioTotal(portfolioId: string, currencyId: string): Promise<PortfolioTotalResponseDto> {
    const portfolio = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) throw new Error("PORTFOLIO_NOT_FOUND");

    const targetCurrency: Currency | null = await this.currenciesRepository.getById(currencyId);
    if (!targetCurrency) throw new Error("CURRENCY_NOT_FOUND");

    this.rateCache.clear();

    const [buys, sells, dividends] = await Promise.all([
      this.userAssetBuyRepository.getAllByPortfolioId(portfolioId),
      this.userAssetSellRepository.getAllByPortfolioId(portfolioId),
      this.userAssetDividendRepository.getAllByPortfolioId(portfolioId),
    ]);

    // ── All heavy calculations in parallel ───────────────────────────────────
    const [totalInvested, totalSells, totalDividends, portfolioMarketValue] = await Promise.all([
      this.sumBuys(buys, currencyId),
      this.sumSells(sells, currencyId),
      this.sumDividends(dividends, currencyId),
      this.computeMarketValue(buys, sells, currencyId),
    ]);
    const netTotal = totalSells + totalDividends - totalInvested;
    const totalValue = portfolioMarketValue + totalSells + totalDividends;

    return {
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalSells: Math.round(totalSells * 100) / 100,
      totalDividends: Math.round(totalDividends * 100) / 100,
      netTotal: Math.round(netTotal * 100) / 100,
      portfolioMarketValue: Math.round(portfolioMarketValue * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
      currencyId: targetCurrency.uuid,
      currencyName: targetCurrency.currency_name,
    };
  }

  private async computeMarketValue(buys: UserAssetBuy[], sells: UserAssetSell[], currencyId: string): Promise<number> {
    // Prefer asset_uuid (direct FK set since schema migration).
    // Fall back to company_name for older records that pre-date the migration.
    const netByAssetUuid = new Map<string, number>();
    const netByCompanyName = new Map<string, number>();

    for (const buy of buys) {
      if (buy.asset_buy_share == null) continue;
      if (buy.asset_uuid) {
        netByAssetUuid.set(buy.asset_uuid, (netByAssetUuid.get(buy.asset_uuid) ?? 0) + buy.asset_buy_share);
      } else if (buy.company_name) {
        netByCompanyName.set(buy.company_name, (netByCompanyName.get(buy.company_name) ?? 0) + buy.asset_buy_share);
      }
    }

    for (const sell of sells) {
      if (sell.asset_sell_share == null) continue;
      if (sell.asset_uuid) {
        netByAssetUuid.set(sell.asset_uuid, (netByAssetUuid.get(sell.asset_uuid) ?? 0) - sell.asset_sell_share);
      } else if (sell.company_name) {
        netByCompanyName.set(sell.company_name, (netByCompanyName.get(sell.company_name) ?? 0) - sell.asset_sell_share);
      }
    }

    const today = new Date();

    const [uuidValues, nameValues] = await Promise.all([
      // ── UUID-based assets (new records) — all parallel ─────────────────────
      Promise.all(Array.from(netByAssetUuid.entries()).map(async ([assetUuid, shares]) => {
        if (shares <= 0) return 0;
        const asset = await this.assetRepository.getAssetFromUUID(assetUuid);
        if (!asset) return 0;
        const price = await this.resolveLatestPrice(asset);
        if (price == null) return 0;
        const rate = await this.getConversionRate(asset.base_currency_uuid, currencyId, today);
        return shares * price * rate;
      })),
      // ── Name-based assets (legacy records) — all parallel ──────────────────
      Promise.all(Array.from(netByCompanyName.entries()).map(async ([companyName, shares]) => {
        if (shares <= 0) return 0;
        let asset = await this.assetRepository.getAssetFromOfficialName(companyName);
        if (!asset) asset = await this.assetRepository.getAssetFromTicker(companyName);
        if (!asset) return 0;
        const price = await this.resolveLatestPrice(asset);
        if (price == null) return 0;
        const rate = await this.getConversionRate(asset.base_currency_uuid, currencyId, today);
        return shares * price * rate;
      })),
    ]);

    return [...uuidValues, ...nameValues].reduce((sum, v) => sum + v, 0);
  }

  /**
   * Resolves the latest price for an asset.
   * Tries the DB first; if no price record exists, falls back to a live Yahoo Finance quote.
   */
  private async resolveLatestPrice(asset: Asset): Promise<number | null> {
    const latestPrice = await this.assetPriceRepository.getLatestAssetPrice(asset.uuid);
    if (latestPrice) return latestPrice.asset_price;

    // No historical price in DB — try a live quote from Yahoo Finance
    if (asset.ticker_name) {
      try {
        const quote = await this.yahooFinanceService.fetchAssetQuote(asset.ticker_name);
        if (quote?.price != null) return quote.price;
      }
      catch {
        // Yahoo unreachable — skip
      }
    }

    return null;
  }

  private async sumBuys(buys: UserAssetBuy[], targetCurrencyId: string): Promise<number> {
    const values = await Promise.all(buys.map(async (buy) => {
      const amount =
        buy.asset_buy_amount ??
        (buy.asset_buy_share != null && buy.asset_buy_price_per_share != null
          ? buy.asset_buy_share * buy.asset_buy_price_per_share
          : null);
      if (amount == null) return 0;
      const rate = await this.getConversionRate(buy.buy_currency_uuid, targetCurrencyId, new Date(buy.buy_date));
      return amount * rate;
    }));
    return values.reduce((sum, v) => sum + v, 0);
  }

  private async sumSells(sells: UserAssetSell[], targetCurrencyId: string): Promise<number> {
    const values = await Promise.all(sells.map(async (sell) => {
      const amount =
        sell.asset_sell_amount ??
        (sell.asset_sell_share != null && sell.average_asset_share_buy_price != null
          ? sell.asset_sell_share * sell.average_asset_share_buy_price
          : null);
      if (amount == null) return 0;
      const rate = await this.getConversionRate(sell.sell_currency_uuid, targetCurrencyId, new Date(sell.sell_date));
      return amount * rate;
    }));
    return values.reduce((sum, v) => sum + v, 0);
  }

  private async sumDividends(dividends: UserAssetDividend[], targetCurrencyId: string): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const values = await Promise.all(dividends.map(async (div) => {
      // Skip upcoming dividends — ex-date hasn't passed yet
      const exDate = new Date(div.cashflow_date);
      if (exDate > today) return 0;
      const rate = await this.getConversionRate(div.currency_uuid, targetCurrencyId, exDate);
      return div.cashflow_amount * rate;
    }));
    return values.reduce((sum, v) => sum + v, 0);
  }

  private getConversionRate(sourceCurrencyId: string | null, targetCurrencyId: string, date: Date): Promise<number> {
    if (!sourceCurrencyId || sourceCurrencyId === targetCurrencyId) return Promise.resolve(1);

    const dateStr = date.toISOString().split("T")[0];
    const cacheKey = `${sourceCurrencyId}→${targetCurrencyId}@${dateStr}`;

    if (!this.rateCache.has(cacheKey)) {
      // Store the Promise — concurrent callers share one DB round-trip
      this.rateCache.set(
        cacheKey,
        this.currenciesRepository
          .getClosestForexRateBeforeOrAt(sourceCurrencyId, targetCurrencyId, date)
          .then(r => r?.forex_rate ?? 1)
          .catch(() => 1),
      );
    }

    return this.rateCache.get(cacheKey)!;
  }
}
