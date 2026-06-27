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
import { UpdateAssetBuyRequestDto } from "../../dtos/portfolio/requests/update.asset.buy.request.dto";
import { UpdateAssetSellRequestDto } from "../../dtos/portfolio/requests/update.asset.sell.request.dto";
import { UpdateAssetDividendRequestDto } from "../../dtos/portfolio/requests/update.asset.dividend.request.dto";
import { PortfolioResponseDto } from "../../dtos/portfolio/responses/portfolio.response.dto";
import { AssetBuyResponseDto } from "../../dtos/portfolio/responses/asset.buy.response.dto";
import { AssetSellResponseDto } from "../../dtos/portfolio/responses/asset.sell.response.dto";
import { AssetDividendResponseDto } from "../../dtos/portfolio/responses/asset.dividend.response.dto";
import { PaginatedResponseDto } from "../../dtos/common/paginated.response.dto";
import AssetCountResponse from "../../dtos/portfolio/responses/asset.count.response";
import { Portfolio } from "../../db_schema/portfolio/portfolio";
import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from '../../db_schema/portfolio/user_asset_sell';
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { Asset, AssetDividend } from "../../db_schema";
import { YahooFinanceService } from "../yahoo.finance.service";
import { CurrenciesRepository } from "../../repositories";

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

  public async getDividendsByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string, company?: string): Promise<PaginatedResponseDto<AssetDividendResponseDto>> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const { rows, count } = await this.userAssetDividendRepository.getByPortfolioId(portfolioId, page, limit, from, to, company);
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

    // Recalculate average buy price and gain on all sells of this asset
    // that fall on or after the new buy date — adding a buy changes the WACO
    // for every subsequent sell.
    if (request.assetId && companyName) {
      await this.recalculateSellsFromDate(
        request.portfolioId,
        request.assetId,
        companyName,
        request.buyDate
      ).catch((err) => {
        console.error("[PortfolioService] recalculate sells error (addBuy):", err instanceof Error ? err.message : String(err));
      });
    }

    // Recalculate all consolidated dividend entries for this asset from the buy date onwards.
    if (request.assetId && asset && companyName) {
      await this.recalculateDividendsForAsset(
        request.portfolioId,
        request.assetId,
        asset,
        companyName,
        request.buyDate
      ).catch((err) => {
        console.error("[PortfolioService] recalculate dividends error (buy):", err instanceof Error ? err.message : String(err));
      });
    }

    return this.portfolioMapper.assetBuyEntityToDto(assetBuy);
  }

  /**
   * Recalculates consolidated UserAssetDividend entries for a given (portfolio, asset) pair
   * for all ex_dates on or after `fromDate`.
   *
   * Strategy (on-the-fly fetch):
   *  1. If the asset has a ticker, always fetch the latest dividends from Yahoo Finance
   *     starting from `fromDate` and upsert them into `asset_dividend`.
   *     This ensures newly-declared dividends and revised amounts are always up-to-date,
   *     without relying on a background startup sync.
   *     Custom assets without a ticker skip this step — their dividends must be entered manually.
   *  2. Load all `asset_dividend` rows with ex_date >= fromDate from the DB.
   *  3. For each ex_date: netShares = totalBought(≤exDate) – totalSold(≤exDate).
   *     • netShares > 0  → create/replace one UserAssetDividend entry
   *     • netShares ≤ 0  → skip (user had sold all shares before this dividend)
   *
   * Dividends are stored in the asset's base currency; the total service converts to
   * the portfolio display currency when computing totals.
   */
  private async recalculateDividendsForAsset(
    portfolioId: string,
    assetId: string,
    asset: Asset,
    companyName: string,
    fromDate: string
  ): Promise<void> {
    // 1. Always fetch fresh dividends from Yahoo from fromDate → now
    //    Skip assets without a ticker (custom assets entered without a market symbol).
    if (asset.ticker_name) {
      try {
        const fetchedDividends = await this.yahooFinanceService.fetchHistoricalDividends(
          asset.ticker_name,
          new Date(fromDate),
          new Date()
        );

        if (fetchedDividends.length > 0) {
          await this.assetDividendRepository.upsertBulk(
            fetchedDividends.map((d) => ({
              asset_uuid: assetId,
              dividend_amount: d.dividends,
              ex_date: d.date,
            }))
          );
          console.log(`[PortfolioService] Upserted ${fetchedDividends.length} dividends for ${asset.ticker_name} from ${fromDate}`);
        }
      }
      catch (err) {
        console.error(`[PortfolioService] Failed to fetch dividends for ${asset.ticker_name}:`, err instanceof Error ? err.message : String(err));
      }
    }

    // 2. Get all asset-level dividends with ex_date >= fromDate from the DB
    const assetDividends: AssetDividend[] = await this.assetDividendRepository.getDividendsAfterDate(assetId, fromDate);
    if (assetDividends.length === 0) return;

    // 3. Dividends are stored in the asset's base currency (total service converts to portfolio currency)
    const dividendCurrencyId: string | null = asset.base_currency_uuid ?? null;
    if (!dividendCurrencyId) {
      console.warn(`[PortfolioService] Asset ${assetId} has no base currency — skipping dividend recalculation`);
      return;
    }

    // 4. Delete all existing UserAssetDividend entries for this (portfolio, asset) from fromDate
    await this.userAssetDividendRepository.deleteByPortfolioAndAssetFromDate(portfolioId, assetId, fromDate);

    // 5. Recreate one consolidated entry per ex_date where the user holds shares
    for (const div of assetDividends) {
      const exDateStr = String(div.ex_date).split("T")[0];

      const [totalBought, totalSold] = await Promise.all([
        this.userAssetBuyRepository.sumSharesByCompanyAndDate(portfolioId, companyName, exDateStr),
        this.userAssetSellRepository.sumSharesByCompanyAndDate(portfolioId, companyName, exDateStr),
      ]);
      const netShares = (totalBought || 0) - (totalSold || 0);

      if (netShares <= 0) continue; // Sold all shares before this dividend — skip

      const cashflowAmount = parseFloat((div.dividend_amount * netShares).toFixed(2));

      try {
        await this.userAssetDividendRepository.add({
          portfolio_uuid: portfolioId,
          asset_uuid: assetId,
          company_name: companyName,
          currency_uuid: dividendCurrencyId,
          cashflow_date: exDateStr as unknown as Date,
          cashflow_amount: cashflowAmount,
          source_buy_uuid: null, // consolidated — not tied to a single buy
        });
      }
      catch (err) {
        console.error(`[PortfolioService] Failed to create consolidated dividend for ex_date ${exDateStr}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  /**
   * Recalculates average_asset_share_buy_price and asset_sell_gain for every sell of
   * this asset whose sell_date >= fromDate.
   *
   * Called after addAssetBuy so that inserting a new buy correctly updates
   * the weighted-average cost (WACO) of all affected downstream sells.
   */
  private async recalculateSellsFromDate(
    portfolioId: string,
    assetId: string,
    companyName: string,
    fromDate: string
  ): Promise<void> {
    const allSells = await this.userAssetSellRepository.getAllByPortfolioId(portfolioId);

    // Keep only sells of this asset on or after fromDate
    const affectedSells = allSells
      .filter(s =>
        ((companyName && s.company_name === companyName) || (assetId && s.asset_uuid === assetId)) &&
        String(s.sell_date).split("T")[0] >= fromDate
      )
      .sort((a, b) => String(a.sell_date).localeCompare(String(b.sell_date)));

    for (const sell of affectedSells) {
      const sellDate       = String(sell.sell_date).split("T")[0];
      const effectiveAsset = assetId ?? sell.asset_uuid;
      if (!sell.asset_sell_share || !effectiveAsset) continue;

      const avgBuy = await this.getAverageBuyPricePerShare(
        portfolioId, effectiveAsset, sellDate, sell.sell_currency_uuid
      );

      let gain: number | null = null;
      if (avgBuy !== null && sell.asset_sell_amount) {
        const pricePerShare = sell.asset_sell_amount / sell.asset_sell_share;
        gain = parseFloat(((pricePerShare - avgBuy) * sell.asset_sell_share).toFixed(2));
      }

      await this.userAssetSellRepository.update(sell.uuid, {
        average_asset_share_buy_price: avgBuy,
        asset_sell_gain: gain,
      });
    }
  }

  /** Resolves the asset for a buy/sell by company_name (official_name first, then ticker_name fallback) */
  private async resolveAssetByCompanyName(companyName: string): Promise<Asset | null> {
    return (
      (await this.assetRepository.getAssetFromOfficialName(companyName)) ??
      (await this.assetRepository.getAssetFromTicker(companyName))
    );
  }

  public async getAvailableShares(portfolioId: string, assetId: string, date: string): Promise<number> {
    const asset: Asset | null = await this.resolveAsset(assetId) as Asset | null;
    if (!asset) return 0;

    const companyName: string | null = asset.official_name ?? asset.ticker_name ?? null;
    // Allow null companyName — asset_uuid fallback in the queries will still find records
    const effectiveCompanyName = companyName ?? "";

    const [totalBought, totalSold, futureBought, futureSold] = await Promise.all([
      this.userAssetBuyRepository.sumSharesByCompanyAndDate(portfolioId, effectiveCompanyName, date, assetId),
      this.userAssetSellRepository.sumSharesByCompanyAndDate(portfolioId, effectiveCompanyName, date, assetId),
      this.userAssetBuyRepository.sumSharesByCompanyAfterDate(portfolioId, effectiveCompanyName, date, assetId),
      this.userAssetSellRepository.sumSharesByCompanyAfterDate(portfolioId, effectiveCompanyName, date, assetId),
    ]);

    // Shares already committed to future sells that exceed future buys must
    // come from the current "pot", so subtract that deficit from what's available now.
    const futureSellDeficit = Math.max(0, (futureSold || 0) - (futureBought || 0));
    return Math.max(0, (totalBought || 0) - (totalSold || 0) - futureSellDeficit);
  }

  public async getAverageBuyPricePerShare(portfolioId: string, assetId: string, date: string, targetCurrencyId: string): Promise<number | null> {
    const asset: Asset | null = await this.resolveAsset(assetId) as Asset | null;
    if (!asset) return null;

    const companyName: string | null = asset.official_name ?? asset.ticker_name ?? null;
    if (!companyName && !assetId) return null;

    // Pass assetId as fallback so buys stored with company_name=null (or a stale name) are still found
    const buys: UserAssetBuy[] = await this.userAssetBuyRepository.getBuysByCompanyAndDate(
      portfolioId,
      companyName ?? "",
      date,
      assetId
    );
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

    if (!request.assetId) {
      throw new Error("ASSET_REQUIRED");
    }

    let companyName: string | null = null;
    let asset: Asset | null = null;
    asset = await this.resolveAsset(request.assetId) as Asset | null;
    if (!asset) throw new Error("ASSET_NOT_FOUND");
    companyName = asset.official_name ?? asset.ticker_name ?? null;
    if (!companyName) throw new Error("ASSET_NO_NAME");

    // Validate: can't sell more shares than available at the sell date
    // (accounts for future sells that must be preserved)
    if (request.assetSellShare != null && request.assetSellShare > 0) {
      const available = await this.getAvailableShares(request.portfolioId, request.assetId!, request.sellDate);
      if (request.assetSellShare > available) {
        throw new Error("INSUFFICIENT_SHARES");
      }
    }

    // Auto-compute average buy price (in sell currency) and capital gain on the backend,
    // so the result is always correct regardless of what the frontend sends.
    let computedAvgBuyPrice: number | null = null;
    let computedGain: number | null = null;

    if (request.assetId && request.assetSellShare && request.assetSellShare > 0 && request.assetSellAmount) {
      try {
        computedAvgBuyPrice = await this.getAverageBuyPricePerShare(
          request.portfolioId,
          request.assetId,
          request.sellDate,
          request.sellCurrencyId
        );
        if (computedAvgBuyPrice !== null) {
          const sellPricePerShare = request.assetSellAmount / request.assetSellShare;
          computedGain = parseFloat(((sellPricePerShare - computedAvgBuyPrice) * request.assetSellShare).toFixed(2));
        }
      }
      catch (err) {
        console.error("[PortfolioService] Failed to compute sell gain:", err instanceof Error ? err.message : String(err));
      }
    }

    const sellEntityData: Partial<UserAssetSell> = {
      ...this.portfolioMapper.addAssetSellDtoToEntity(request, companyName),
      average_asset_share_buy_price: computedAvgBuyPrice,
      asset_sell_gain: computedGain,
    };

    const assetSell: UserAssetSell = await this.userAssetSellRepository.add(sellEntityData);

    // Recalculate dividends from sell date onwards: shares decreased, some dividends may vanish
    if (request.assetId && asset && companyName) {
      await this.recalculateDividendsForAsset(
        request.portfolioId,
        request.assetId,
        asset,
        companyName,
        request.sellDate
      ).catch((err) => {
        console.error("[PortfolioService] recalculate dividends error (sell):", err instanceof Error ? err.message : String(err));
      });
    }

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

  public async updateAssetBuy(buyId: string, dto: UpdateAssetBuyRequestDto): Promise<AssetBuyResponseDto> {
    const existing = await this.userAssetBuyRepository.getById(buyId);
    if (!existing) throw new Error("BUY_NOT_FOUND");

    const portfolioId = existing.portfolio_uuid;
    const assetId     = existing.asset_uuid;
    const oldDate     = String(existing.buy_date).split("T")[0];

    // Resolve asset/company
    let companyName: string | null = existing.company_name;
    let asset: Asset | null = null;
    if (assetId) {
      asset = await this.resolveAsset(assetId) as Asset | null;
      companyName = asset?.official_name ?? asset?.ticker_name ?? companyName;
    }

    // Apply update
    const updated = await this.userAssetBuyRepository.update(buyId, {
      buy_currency_uuid:        dto.buyCurrencyId as unknown as string,
      buy_date:                 dto.buyDate as unknown as Date,
      asset_buy_amount:         dto.assetBuyAmount ?? null,
      asset_buy_share:          dto.assetBuyShare ?? null,
      asset_buy_price_per_share: dto.assetBuyPricePerShare ?? null,
    });
    if (!updated) throw new Error("BUY_NOT_FOUND");

    // Validate: all sells of this asset must still be satisfiable after the change
    if (companyName || assetId) {
      const allSells = await this.userAssetSellRepository.getAllByPortfolioId(portfolioId);
      const assetSells = allSells
        .filter(s => (companyName && s.company_name === companyName) || (assetId && s.asset_uuid === assetId))
        .sort((a, b) => String(a.sell_date).localeCompare(String(b.sell_date)));

      for (const sell of assetSells) {
        const sellDate = String(sell.sell_date).split("T")[0];
        const [bought, sold] = await Promise.all([
          this.userAssetBuyRepository.sumSharesByCompanyAndDate(portfolioId, companyName ?? "", sellDate, assetId ?? undefined),
          this.userAssetSellRepository.sumSharesByCompanyAndDate(portfolioId, companyName ?? "", sellDate, assetId ?? undefined),
        ]);
        const available = (bought ?? 0) - (sold ?? 0) + (sell.asset_sell_share ?? 0);
        if ((sell.asset_sell_share ?? 0) > available) {
          // Revert
          await this.userAssetBuyRepository.update(buyId, {
            buy_currency_uuid:        existing.buy_currency_uuid,
            buy_date:                 existing.buy_date,
            asset_buy_amount:         existing.asset_buy_amount,
            asset_buy_share:          existing.asset_buy_share,
            asset_buy_price_per_share: existing.asset_buy_price_per_share,
          });
          throw new Error("INSUFFICIENT_SHARES_FOR_EXISTING_SELLS");
        }
      }

      // Recompute avg buy price and gain on all sells of this asset.
      // Use the buy's assetId first — the sell may not have asset_uuid set
      // if it was added without selecting an explicit asset from the picker.
      for (const sell of assetSells) {
        const sellDate = String(sell.sell_date).split("T")[0];
        const effectiveAssetId = assetId ?? sell.asset_uuid ?? (asset?.uuid ?? null);
        if (!sell.asset_sell_share || !effectiveAssetId) continue;

        const avgBuy = await this.getAverageBuyPricePerShare(
          portfolioId, effectiveAssetId, sellDate, sell.sell_currency_uuid
        );

        // Always write back so a stale gain is never left in place.
        let gain: number | null = null;
        if (avgBuy !== null && sell.asset_sell_amount) {
          const pricePerShare = sell.asset_sell_amount / sell.asset_sell_share;
          gain = parseFloat(((pricePerShare - avgBuy) * sell.asset_sell_share).toFixed(2));
        }
        await this.userAssetSellRepository.update(sell.uuid, {
          average_asset_share_buy_price: avgBuy,
          asset_sell_gain: gain,
        });
      }

      // Recalculate dividends from min(old date, new date)
      if (asset && companyName) {
        const fromDate = oldDate < dto.buyDate ? oldDate : dto.buyDate;
        await this.recalculateDividendsForAsset(portfolioId, asset.uuid, asset, companyName, fromDate).catch(() => {});
      }
    }

    const refreshed = await this.userAssetBuyRepository.getById(buyId);
    return this.portfolioMapper.assetBuyEntityToDto(refreshed!);
  }

  public async updateAssetSell(sellId: string, dto: UpdateAssetSellRequestDto): Promise<AssetSellResponseDto> {
    const existing = await this.userAssetSellRepository.getById(sellId);
    if (!existing) throw new Error("SELL_NOT_FOUND");

    const portfolioId = existing.portfolio_uuid;
    const assetId     = existing.asset_uuid;
    const oldDate     = String(existing.sell_date).split("T")[0];
    const companyName = existing.company_name;

    // Validate available shares at the new date (excluding this sell itself)
    // getAvailableShares already accounts for future sell deficit; adding back
    // this sell's shares "removes" it from the calculation regardless of whether
    // its old date falls before or after the new date.
    if (assetId && dto.assetSellShare > 0) {
      const rawAvailable = await this.getAvailableShares(portfolioId, assetId, dto.sellDate);
      const available = rawAvailable + (existing.asset_sell_share ?? 0);
      if (dto.assetSellShare > available) throw new Error("INSUFFICIENT_SHARES");
    }

    // Compute avg buy price and gain
    let avgBuyPrice: number | null = null;
    let gain: number | null = null;
    const totalAmount = dto.assetSellShare * dto.assetSellPricePerShare;

    if (assetId && dto.assetSellShare > 0) {
      avgBuyPrice = await this.getAverageBuyPricePerShare(portfolioId, assetId, dto.sellDate, dto.sellCurrencyId);
      if (avgBuyPrice !== null) {
        gain = parseFloat(((dto.assetSellPricePerShare - avgBuyPrice) * dto.assetSellShare).toFixed(2));
      }
    }

    const updated = await this.userAssetSellRepository.update(sellId, {
      sell_currency_uuid:            dto.sellCurrencyId as unknown as string,
      sell_date:                     dto.sellDate as unknown as Date,
      asset_sell_share:              dto.assetSellShare,
      asset_sell_amount:             parseFloat(totalAmount.toFixed(2)),
      average_asset_share_buy_price: avgBuyPrice,
      asset_sell_gain:               gain,
    });
    if (!updated) throw new Error("SELL_NOT_FOUND");

    // Recalculate dividends from min(old date, new date)
    if (assetId && companyName) {
      const asset = await this.resolveAsset(assetId) as Asset | null;
      if (asset) {
        const fromDate = oldDate < dto.sellDate ? oldDate : dto.sellDate;
        await this.recalculateDividendsForAsset(portfolioId, assetId, asset, companyName, fromDate).catch(() => {});
      }
    }

    const refreshed = await this.userAssetSellRepository.getById(sellId);
    return this.portfolioMapper.assetSellEntityToDto(refreshed!);
  }

  public async updateAssetDividend(dividendId: string, dto: UpdateAssetDividendRequestDto): Promise<AssetDividendResponseDto> {
    const existing = await this.userAssetDividendRepository.getById(dividendId);
    if (!existing) throw new Error("DIVIDEND_NOT_FOUND");

    const updated = await this.userAssetDividendRepository.update(dividendId, {
      currency_uuid:    dto.currencyId as unknown as string,
      cashflow_date:    dto.cashflowDate as unknown as Date,
      cashflow_amount:  dto.cashflowAmount,
    });
    if (!updated) throw new Error("DIVIDEND_NOT_FOUND");

    const refreshed = await this.userAssetDividendRepository.getById(dividendId);
    return this.portfolioMapper.assetDividendEntityToDto(refreshed!);
  }

  public async deleteAssetBuy(buyId: string): Promise<void> {
    // Capture buy info before deletion so we can recalculate downstream data afterwards
    const buy = await this.userAssetBuyRepository.getById(buyId);
    if (!buy) throw new Error("BUY_NOT_FOUND");

    const portfolioId = buy.portfolio_uuid;
    const companyName = buy.company_name;
    const assetId = buy.asset_uuid;
    const buyDate = String(buy.buy_date).split("T")[0];

    // Remove the buy
    await this.userAssetBuyRepository.remove(buyId);

    // Resolve asset (needed for dividends and avg-price recalculation)
    let asset: Asset | null = null;
    if (assetId) {
      asset = await this.resolveAsset(assetId) as Asset | null;
    } else if (companyName) {
      asset = await this.resolveAssetByCompanyName(companyName);
    }

    // Recompute avg buy price and capital gain on every sell of this company.
    // Deleting a buy changes the weighted-average cost basis, so all sell gains
    // must be refreshed — not just those after the deleted buy's date.
    if (companyName || assetId) {
      const allSells = await this.userAssetSellRepository.getAllByPortfolioId(portfolioId);
      const companySells = allSells.filter(
        (s) => (companyName && s.company_name === companyName) || (assetId && s.asset_uuid === assetId)
      );

      for (const sell of companySells) {
        const sellDate = String(sell.sell_date).split("T")[0];
        // Fallback chain: uuid from deleted buy → sell's own asset_uuid → asset resolved by company name
        const effectiveAssetId = assetId ?? sell.asset_uuid ?? asset?.uuid ?? null;
        if (!sell.asset_sell_share || !effectiveAssetId) continue;

        try {
          const avgBuy = await this.getAverageBuyPricePerShare(
            portfolioId,
            effectiveAssetId,
            sellDate,
            sell.sell_currency_uuid
          );

          // Always write back — even when avgBuy is null (no priced buys remaining).
          // Keeping a stale gain when the buy pool changes would be misleading.
          let gain: number | null = null;
          if (avgBuy !== null && sell.asset_sell_amount) {
            const pricePerShare = sell.asset_sell_amount / sell.asset_sell_share;
            gain = parseFloat(((pricePerShare - avgBuy) * sell.asset_sell_share).toFixed(2));
          }
          await this.userAssetSellRepository.update(sell.uuid, {
            average_asset_share_buy_price: avgBuy,
            asset_sell_gain: gain,
          });
        } catch (err) {
          console.error("[PortfolioService] Failed to recompute sell gain after buy deletion:", err instanceof Error ? err.message : String(err));
        }
      }
    }

    // Recalculate consolidated dividends from the buy's date onwards
    if (asset && companyName) {
      await this.recalculateDividendsForAsset(portfolioId, asset.uuid, asset, companyName, buyDate).catch((err) => {
        console.error("[PortfolioService] recalculate dividends error (delete buy):", err instanceof Error ? err.message : String(err));
      });
    }
  }

  public async deleteAssetSell(sellId: string): Promise<void> {
    // Capture sell info before deletion so we can recalculate dividends afterwards
    const sell = await this.userAssetSellRepository.getById(sellId);
    if (!sell) throw new Error("SELL_NOT_FOUND");

    const portfolioId = sell.portfolio_uuid;
    const companyName = sell.company_name;
    const sellDate = String(sell.sell_date).split("T")[0];

    // Remove the sell (shares increase → dividends from sellDate may reappear or grow)
    await this.userAssetSellRepository.remove(sellId);

    // Recalculate consolidated dividends from the sell's date onwards
    if (companyName) {
      const asset = await this.resolveAssetByCompanyName(companyName);
      if (asset) {
        await this.recalculateDividendsForAsset(portfolioId, asset.uuid, asset, companyName, sellDate).catch((err) => {
          console.error("[PortfolioService] recalculate dividends error (delete sell):", err instanceof Error ? err.message : String(err));
        });
      }
    }
  }

  public async deleteAssetDividend(dividendId: string): Promise<void> {
    const deleted: boolean = await this.userAssetDividendRepository.remove(dividendId);
    if (!deleted) {
      throw new Error("DIVIDEND_NOT_FOUND");
    }
  }

  public async holdingsInPortfolio(portfolioId: string) {
    const userAssetBuy = await this.userAssetBuyRepository.getAllByPortfolioId(portfolioId)
    const userAssetSell = await this.userAssetSellRepository.getAllByPortfolioId(portfolioId)

    const balances = new Map<string, number>()

    for (const buy of userAssetBuy) {
      if(!buy.asset_uuid || !buy.asset_buy_amount) continue
      const current = balances.get(buy.asset_uuid) ?? 0
      balances.set(buy.asset_uuid, current + buy.asset_buy_amount)
    }

    for (const sell of userAssetSell) {
      if(!sell.asset_uuid || !sell.asset_sell_amount) continue
      const current = balances.get(sell.asset_uuid) ?? 0
      balances.set(sell.asset_uuid, current - sell.asset_sell_amount)
    }

    return Array.from(balances.entries()).map(([assetId, amount]) => ({
      assetId,
      amount,
    }))
  }
}
