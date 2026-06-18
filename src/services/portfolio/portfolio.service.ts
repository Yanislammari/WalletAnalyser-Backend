import { PortfolioMapper } from "../../mappers/portfolio.mapper";
import { PortfolioRepository } from "../../repositories/portfolio/portfolio.repository";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user.asset.buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user.asset.sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user.asset.dividend.repository";
import { AssetRepository } from "../../repositories/asset/asset.repository";
import { AssetDividendRepository } from "../../repositories/asset/asset.dividend.repository";
import { AddPortfolioRequestDto } from "../../dtos/portfolio/requests/add.portfolio.request.dto";
import { AddAssetBuyRequestDto } from "../../dtos/portfolio/requests/add.asset.buy.request.dto";
import { AddAssetSellRequestDto } from "../../dtos/portfolio/requests/add.asset.sell.request.dto";
import { AddAssetDividendRequestDto } from "../../dtos/portfolio/requests/add.asset.dividend.request.dto";
import { PortfolioResponseDto } from "../../dtos/portfolio/responses/portfolio.response.dto";
import { AssetBuyResponseDto } from "../../dtos/portfolio/responses/asset.buy.response.dto";
import { AssetSellResponseDto } from "../../dtos/portfolio/responses/asset.sell.response.dto";
import { AssetDividendResponseDto } from "../../dtos/portfolio/responses/asset.dividend.response.dto";
import { PaginatedResponseDto } from "../../dtos/common/paginated.response.dto";
import AssetCountResponse from "../../dtos/portfolio/responses/asset.count.response";
import { Portfolio } from "../../db_schema/portfolio/portfolio";
import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { Asset, AssetDividend } from "../../db_schema";
import { YahooFinanceService } from "../yahoo.finance.service";
import { CurrenciesRepository } from "../../repositories/currencies.repository";

export class PortfolioService {
  private readonly portfolioRepository: PortfolioRepository;
  private readonly userAssetBuyRepository: UserAssetBuyRepository;
  private readonly userAssetSellRepository: UserAssetSellRepository;
  private readonly userAssetDividendRepository: UserAssetDividendRepository;
  private readonly assetRepository: AssetRepository;
  private readonly assetDividendRepository: AssetDividendRepository;
  private readonly yahooFinanceService: YahooFinanceService;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly portfolioMapper: PortfolioMapper;

  constructor() {
    this.portfolioRepository = new PortfolioRepository();
    this.userAssetBuyRepository = new UserAssetBuyRepository();
    this.userAssetSellRepository = new UserAssetSellRepository();
    this.userAssetDividendRepository = new UserAssetDividendRepository();
    this.assetRepository = new AssetRepository();
    this.assetDividendRepository = new AssetDividendRepository();
    this.yahooFinanceService = new YahooFinanceService();
    this.currenciesRepository = new CurrenciesRepository();
    this.portfolioMapper = new PortfolioMapper();
  }

  /** Looks up asset — custom assets are now stored in the regular assets table with is_custom=true */
  private async resolveAsset(assetId: string): Promise<Asset | null> {
    return this.assetRepository.getAssetFromUUID(assetId);
  }

  public async createPortfolio(dto: AddPortfolioRequestDto): Promise<PortfolioResponseDto> {
    const portfolio: Portfolio = await this.portfolioRepository.add(this.portfolioMapper.addPortfolioDtoToEntity(dto));
    return this.portfolioMapper.portfolioEntityToDto(portfolio);
  }

  public async getPortfoliosByUserId(userId: string, page: number, limit: number, search?: string): Promise<PaginatedResponseDto<PortfolioResponseDto>> {
    const { rows, count } = await this.portfolioRepository.getByUserId(userId, page, limit, search);
    return { data: rows.map((portfolio) => this.portfolioMapper.portfolioEntityToDto(portfolio)), total: count, page, limit };
  }

  public async getPortfolioById(portfolioId: string): Promise<PortfolioResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }
    
    return this.portfolioMapper.portfolioEntityToDto(portfolio);
  }

  public async getBuysByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string, company?: string): Promise<PaginatedResponseDto<AssetBuyResponseDto>> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const { rows, count } = await this.userAssetBuyRepository.getByPortfolioId(portfolioId, page, limit, from, to, company);
    return { data: rows.map((row) => this.portfolioMapper.assetBuyEntityToDto(row)), total: count, page, limit };
  }

  public async getSellsByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string, company?: string): Promise<PaginatedResponseDto<AssetSellResponseDto>> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const { rows, count } = await this.userAssetSellRepository.getByPortfolioId(portfolioId, page, limit, from, to, company);
    return { data: rows.map((row) => this.portfolioMapper.assetSellEntityToDto(row)), total: count, page, limit };
  }

  public async getDividendsByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string): Promise<PaginatedResponseDto<AssetDividendResponseDto>> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const { rows, count } = await this.userAssetDividendRepository.getByPortfolioId(portfolioId, page, limit, from, to);
    return { data: rows.map((row) => this.portfolioMapper.assetDividendEntityToDto(row)), total: count, page, limit };
  }

  public async addAssetBuy(request: AddAssetBuyRequestDto): Promise<AssetBuyResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(request.portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    let companyName: string | null = null;
    let asset: Asset | null = null;
    if (request.assetId) {
      asset = await this.resolveAsset(request.assetId) as Asset | null;
      companyName = asset?.official_name ?? asset?.ticker_name ?? null;
    }

    const assetBuy: UserAssetBuy = await this.userAssetBuyRepository.add(this.portfolioMapper.addAssetBuyDtoToEntity(request, companyName));

    // Auto-create UserAssetDividend entries for any dividends whose ex_date >= buyDate.
    // Derive share count: prefer explicit assetBuyShare, fall back to amount ÷ pricePerShare.
    const effectiveShares: number | null =
      request.assetBuyShare != null && request.assetBuyShare > 0
        ? request.assetBuyShare
        : request.assetBuyAmount != null &&
          request.assetBuyPricePerShare != null &&
          request.assetBuyPricePerShare > 0
          ? request.assetBuyAmount / request.assetBuyPricePerShare
          : null;

    if (request.assetId && asset && effectiveShares != null && effectiveShares > 0) {
      await this.autoCreateDividendsForBuy(
        request.portfolioId,
        assetBuy.uuid,
        request.assetId,
        asset,
        companyName,
        request.buyDate,
        effectiveShares,
        request.buyCurrencyId
      ).catch((err) => {
        console.error("[PortfolioService] auto-create dividends error:", err instanceof Error ? err.message : String(err));
      });
    }

    return this.portfolioMapper.assetBuyEntityToDto(assetBuy);
  }

  private async autoCreateDividendsForBuy(
    portfolioId: string,
    buyId: string,
    assetId: string,
    asset: Asset,
    companyName: string | null,
    buyDate: string,
    shares: number,
    buyCurrencyId: string
  ): Promise<void> {
    // If AssetDividend has no data at all for this asset (e.g., startup sync hasn't run yet),
    // fetch 5yr of dividends from Yahoo Finance now and store them.
    const oldestDates = await this.assetDividendRepository.getOldestDividendDatesByAssets([assetId]);
    if (!oldestDates.has(assetId) && asset.ticker_name) {
      try {
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

        const fetchedDividends = await this.yahooFinanceService.fetchHistoricalDividends(
          asset.ticker_name,
          fiveYearsAgo,
          new Date()
        );

        if (fetchedDividends.length > 0) {
          await this.assetDividendRepository.bulkCreate(
            fetchedDividends.map((d) => ({
              asset_uuid: assetId,
              dividend_amount: d.dividends,
              ex_date: d.date,
            }))
          );
          console.log(`[PortfolioService] Fetched and stored ${fetchedDividends.length} dividends for ${asset.ticker_name}`);
        }
      }
      catch (err) {
        console.error(`[PortfolioService] Failed to fetch dividends for ${asset.ticker_name}:`, err instanceof Error ? err.message : String(err));
      }
    }

    // Get dividends whose ex_date is on or after the buy date (dividends the user is entitled to)
    const assetDividends: AssetDividend[] = await this.assetDividendRepository.getDividendsAfterDate(assetId, buyDate);
    if (assetDividends.length === 0) return;

    // Use the buy currency for dividends — they are denominated in the same currency as the purchase
    const dividendCurrencyId: string = buyCurrencyId;

    // Determine if we need to convert from asset base currency to buy currency
    const assetBaseCurrencyId: string | null = asset.base_currency_uuid ?? null;
    const needsConversion: boolean = !!assetBaseCurrencyId && assetBaseCurrencyId !== buyCurrencyId;

    for (const div of assetDividends) {
      const exDateStr = String(div.ex_date).split("T")[0];

      // Convert dividend amount from asset base currency to buy currency if needed
      let dividendPerShare: number = div.dividend_amount;
      if (needsConversion && assetBaseCurrencyId) {
        try {
          const exDate = new Date(exDateStr);
          const forexRate = await this.currenciesRepository.getClosestForexRateBeforeOrAt(
            assetBaseCurrencyId,
            buyCurrencyId,
            exDate
          );
          if (forexRate?.forex_rate) {
            dividendPerShare = div.dividend_amount * forexRate.forex_rate;
          }
        }
        catch {
          // fallback: use unconverted amount
        }
      }

      const cashflowAmount = parseFloat((dividendPerShare * shares).toFixed(2));

      try {
        await this.userAssetDividendRepository.add({
          portfolio_uuid: portfolioId,
          asset_uuid: assetId,
          company_name: companyName,
          currency_uuid: dividendCurrencyId,
          cashflow_date: exDateStr as unknown as Date,
          cashflow_amount: cashflowAmount,
          source_buy_uuid: buyId,
        });
      }
      catch (err) {
        console.error(`[PortfolioService] failed to auto-create dividend for ex_date ${exDateStr}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  public async getAvailableShares(portfolioId: string, assetId: string, date: string): Promise<number> {
    const asset: Asset | null = await this.resolveAsset(assetId) as Asset | null;
    if (!asset) return 0;

    const companyName: string | null = asset.official_name ?? asset.ticker_name ?? null;
    if (!companyName) return 0;

    const [totalBought, totalSold] = await Promise.all([
      this.userAssetBuyRepository.sumSharesByCompanyAndDate(portfolioId, companyName, date),
      this.userAssetSellRepository.sumSharesByCompanyAndDate(portfolioId, companyName, date),
    ]);

    return Math.max(0, (totalBought || 0) - (totalSold || 0));
  }

  public async getAverageBuyPricePerShare(portfolioId: string, assetId: string, date: string, targetCurrencyId: string): Promise<number | null> {
    const asset: Asset | null = await this.resolveAsset(assetId) as Asset | null;
    if (!asset) return null;

    const companyName: string | null = asset.official_name ?? asset.ticker_name ?? null;
    if (!companyName) return null;

    const buys: UserAssetBuy[] = await this.userAssetBuyRepository.getBuysByCompanyAndDate(portfolioId, companyName, date);
    if (buys.length === 0) return null;

    let weightedPriceSum = 0;
    let totalShares = 0;

    for (const buy of buys) {
      const shares: number = buy.asset_buy_share!;
      const priceInBuyCurrency: number = buy.asset_buy_price_per_share!;
      const buyCurrencyId: string = buy.buy_currency_uuid;

      let priceInTargetCurrency: number = priceInBuyCurrency;

      if (buyCurrencyId !== targetCurrencyId) {
        try {
          const buyDate = new Date(buy.buy_date);
          const forexRate = await this.currenciesRepository.getClosestForexRateBeforeOrAt(
            buyCurrencyId,
            targetCurrencyId,
            buyDate
          );
          if (forexRate?.forex_rate) {
            priceInTargetCurrency = priceInBuyCurrency * forexRate.forex_rate;
          }
        }
        catch {
          // fallback: use unconverted price
        }
      }

      weightedPriceSum += priceInTargetCurrency * shares;
      totalShares += shares;
    }

    if (totalShares === 0) return null;
    return parseFloat((weightedPriceSum / totalShares).toFixed(6));
  }

  public async addAssetSell(request: AddAssetSellRequestDto): Promise<AssetSellResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(request.portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    let companyName: string | null = null;
    let asset: Asset | null = null;
    if (request.assetId) {
      asset = await this.resolveAsset(request.assetId) as Asset | null;
      companyName = asset?.official_name ?? asset?.ticker_name ?? null;
    }

    // Validate: can't sell more shares than owned at the sell date
    if (request.assetSellShare != null && request.assetSellShare > 0 && request.assetId && companyName) {
      const [totalBought, totalSold] = await Promise.all([
        this.userAssetBuyRepository.sumSharesByCompanyAndDate(request.portfolioId, companyName, request.sellDate),
        this.userAssetSellRepository.sumSharesByCompanyAndDate(request.portfolioId, companyName, request.sellDate),
      ]);
      const available = Math.max(0, (totalBought || 0) - (totalSold || 0));
      if (request.assetSellShare > available) {
        throw new Error("INSUFFICIENT_SHARES");
      }
    }

    const assetSell: UserAssetSell = await this.userAssetSellRepository.add(this.portfolioMapper.addAssetSellDtoToEntity(request, companyName));
    return this.portfolioMapper.assetSellEntityToDto(assetSell);
  }

  public async addAssetDividend(request: AddAssetDividendRequestDto): Promise<AssetDividendResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(request.portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    let companyName: string | null = null;
    if (request.assetId) {
      const asset: Asset | null = await this.resolveAsset(request.assetId) as Asset | null;
      companyName = asset?.official_name ?? asset?.ticker_name ?? null;
    }

    const assetDividend: UserAssetDividend = await this.userAssetDividendRepository.add(this.portfolioMapper.addAssetDividendDtoToEntity(request, companyName));
    return this.portfolioMapper.assetDividendEntityToDto(assetDividend);
  }

  public async getCompaniesByPortfolioId(portfolioId: string): Promise<string[]> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const [buyCompanies, sellCompanies] = await Promise.all([
      this.userAssetBuyRepository.getDistinctCompanies(portfolioId),
      this.userAssetSellRepository.getDistinctCompanies(portfolioId),
    ]);

    return [...new Set([...buyCompanies, ...sellCompanies])].sort();
  }

  public async getAssetCountByPortfolioId(portfolioId: string): Promise<AssetCountResponse> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const [buys, sells, dividends] = await Promise.all([
      this.userAssetBuyRepository.countByPortfolioId(portfolioId),
      this.userAssetSellRepository.countByPortfolioId(portfolioId),
      this.userAssetDividendRepository.countByPortfolioId(portfolioId),
    ]);

    return { buys, sells, dividends, total: buys + sells + dividends };
  }

  public async deletePortfolio(portfolioId: string): Promise<void> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    await this.portfolioRepository.remove(portfolioId);
  }

  public async deleteAssetBuy(buyId: string): Promise<void> {
    // Delete auto-created dividends linked to this buy before removing the buy itself
    await this.userAssetDividendRepository.deleteBySourceBuyId(buyId);

    const deleted: boolean = await this.userAssetBuyRepository.remove(buyId);
    if (!deleted) {
      throw new Error("BUY_NOT_FOUND");
    }
  }

  public async deleteAssetSell(sellId: string): Promise<void> {
    const deleted: boolean = await this.userAssetSellRepository.remove(sellId);
    if (!deleted) {
      throw new Error("SELL_NOT_FOUND");
    }
  }

  public async deleteAssetDividend(dividendId: string): Promise<void> {
    const deleted: boolean = await this.userAssetDividendRepository.remove(dividendId);
    if (!deleted) {
      throw new Error("DIVIDEND_NOT_FOUND");
    }
  }
}
