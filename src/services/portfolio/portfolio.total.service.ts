import { Currency } from "../../db_schema";
import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { PortfolioRepository } from "../../repositories/portfolio/portfolio.repository";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user.asset.buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user.asset.sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user.asset.dividend.repository";
import { CurrenciesRepository } from "../../repositories/currencies.repository";
import { PortfolioTotalResponseDto } from "../../dtos/portfolio/responses/portfolio.total.response.dto";

export class PortfolioTotalService {
  private readonly portfolioRepository: PortfolioRepository;
  private readonly userAssetBuyRepository: UserAssetBuyRepository;
  private readonly userAssetSellRepository: UserAssetSellRepository;
  private readonly userAssetDividendRepository: UserAssetDividendRepository;
  private readonly currenciesRepository: CurrenciesRepository;

  // Cache for forex rates during a single calculation to avoid repeated DB hits
  private rateCache: Map<string, number> = new Map();

  constructor() {
    this.portfolioRepository = new PortfolioRepository();
    this.userAssetBuyRepository = new UserAssetBuyRepository();
    this.userAssetSellRepository = new UserAssetSellRepository();
    this.userAssetDividendRepository = new UserAssetDividendRepository();
    this.currenciesRepository = new CurrenciesRepository();
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

    const totalInvested = await this.sumBuys(buys, currencyId);
    const totalSells = await this.sumSells(sells, currencyId);
    const totalDividends = await this.sumDividends(dividends, currencyId);
    const netTotal = totalSells + totalDividends - totalInvested;

    return {
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalSells: Math.round(totalSells * 100) / 100,
      totalDividends: Math.round(totalDividends * 100) / 100,
      netTotal: Math.round(netTotal * 100) / 100,
      currencyId: targetCurrency.uuid,
      currencyName: targetCurrency.currency_name,
    };
  }

  private async sumBuys(buys: UserAssetBuy[], targetCurrencyId: string): Promise<number> {
    let total = 0;
    for (const buy of buys) {
      const amount =
        buy.asset_buy_amount ??
        (buy.asset_buy_share != null && buy.asset_buy_price_per_share != null
          ? buy.asset_buy_share * buy.asset_buy_price_per_share
          : null);

      if (amount == null) continue;

      const rate = await this.getConversionRate(buy.buy_currency_uuid, targetCurrencyId, new Date(buy.buy_date));
      total += amount * rate;
    }
    return total;
  }

  private async sumSells(sells: UserAssetSell[], targetCurrencyId: string): Promise<number> {
    let total = 0;
    for (const sell of sells) {
      const amount =
        sell.asset_sell_amount ??
        (sell.asset_sell_share != null && sell.average_asset_share_buy_price != null
          ? sell.asset_sell_share * sell.average_asset_share_buy_price
          : null);

      if (amount == null) continue;

      const rate = await this.getConversionRate(sell.sell_currency_uuid, targetCurrencyId, new Date(sell.sell_date));
      total += amount * rate;
    }
    return total;
  }

  private async sumDividends(dividends: UserAssetDividend[], targetCurrencyId: string): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let total = 0;
    for (const div of dividends) {
      // Skip upcoming dividends — ex-date hasn't passed yet
      const exDate = new Date(div.cashflow_date);
      if (exDate > today) continue;

      const rate = await this.getConversionRate(div.currency_uuid, targetCurrencyId, exDate);
      total += div.cashflow_amount * rate;
    }
    return total;
  }

  private async getConversionRate(sourceCurrencyId: string, targetCurrencyId: string, date: Date): Promise<number> {
    if (sourceCurrencyId === targetCurrencyId) return 1;

    // Round date to day for cache key
    const dateStr = date.toISOString().split("T")[0];
    const cacheKey = `${sourceCurrencyId}→${targetCurrencyId}@${dateStr}`;

    if (this.rateCache.has(cacheKey)) {
      return this.rateCache.get(cacheKey)!;
    }

    try {
      const forexRate = await this.currenciesRepository.getClosestForexRateBeforeOrAt(
        sourceCurrencyId,
        targetCurrencyId,
        date
      );

      const rate = forexRate?.forex_rate ?? 1;
      this.rateCache.set(cacheKey, rate);
      return rate;
    }
    catch {
      return 1;
    }
  }
}
