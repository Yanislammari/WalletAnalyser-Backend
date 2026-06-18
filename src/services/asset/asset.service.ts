import { AssetRepository } from "./../../repositories/asset/asset.repository";
import { AssetDatabaseModel } from "../../models";
import { Asset, attributesAsset } from "../../db_schema";
import { AssetPrice } from "../../db_schema/asset/asset_price";
import { Op } from "sequelize";
import { AssetShort, MetaDataAssets, MetaDataAssetShort } from "../../dtos";
import { AssetPriceRepository } from "../../repositories";
import { AssetDividendRepository } from "../../repositories/asset/asset.dividend.repository";
import { CurrenciesRepository } from "../../repositories/currencies/currencies.repository";
import { YahooFinanceService } from "../yahoo.finance.service";
import { AssetMapper } from "../../mappers/asset.mapper";
import { AssetResponseDto } from "../../dtos/asset/responses/asset.response.dto";
import { AssetPriceResponseDto } from "../../dtos/asset/responses/asset.price.response.dto";
import { sequelize } from "../../config";

export class AssetService {
  private readonly assetRepository: AssetRepository;
  private readonly assetPriceRepository: AssetPriceRepository;
  private readonly assetDividendRepository: AssetDividendRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly yahooFinanceService: YahooFinanceService;
  private readonly assetMapper: AssetMapper;

  constructor() {
    this.assetRepository = new AssetRepository();
    this.assetPriceRepository = new AssetPriceRepository();
    this.assetDividendRepository = new AssetDividendRepository();
    this.currenciesRepository = new CurrenciesRepository();
    this.yahooFinanceService = new YahooFinanceService();
    this.assetMapper = new AssetMapper();
  }

  public async getAssets(type?: string, offset = 0, limit = 100, search?: string): Promise<MetaDataAssets> {
    const where: any = {}
    if (type) {
      where[attributesAsset.asset_type] = { [Op.in]: [type] }
    }

    if (search) {
      where[attributesAsset.official_name] = { [Op.iLike]: `${search}%` }
    }
    const assets : Asset[] = await this.assetRepository.get({
      where,
      offset : offset,
      limit : limit,
      order: [
        [
          sequelize.literal(`
            CASE
              WHEN "${attributesAsset.official_name}" ~ '^[0-9]'
              THEN 1
              ELSE 0
            END
          `),
          "ASC",
        ],
        [attributesAsset.official_name, "ASC"],
      ],
    })

    const metaDataAssets: MetaDataAssetShort[] = await Promise.all(assets.map( async (asset : Asset) => {
      const last_update = (await this.assetPriceRepository.getLatestAssetPrice(asset.uuid))?.asset_price_date
      return {
        asset : {
          uuid: asset.uuid,
          base_currency_uuid: asset.base_currency_uuid,
          ticker_name: asset.ticker_name,
          official_name: asset.official_name,
          sector_uuid: asset.sector_uuid,
          country_uuid: asset.country_uuid,
        },
        last_update : last_update
      }
    }))

    const length = (await this.assetRepository.get({ where })).length
    return { length , assets :  metaDataAssets }
  }

  public async createAsset(asset: AssetDatabaseModel) : Promise<AssetShort> {
    const exist = await this.assetRepository.getAssetFromTicker(asset.ticker_name!)
    if( exist ) {
      throw Error("ALREADY_EXIST")
    }
    const exist1 = await this.assetRepository.getAssetFromOfficialName(asset.official_name!)
    if( exist1 ) {
      throw Error("ALREADY_EXIST")
    }
    return this.assetRepository.addStrictlyNewAssetFromAssetToDatabase(asset);
  }

  public async updateAsset(uuid: string, asset: AssetDatabaseModel): Promise<AssetShort | null> {
    const exist1 = await this.assetRepository.getAssetFromOfficialName(asset.official_name!)
    if( exist1 && exist1.uuid != uuid ) {
      throw Error("ALREADY_EXIST")
    }
    const exist = await this.assetRepository.getAssetFromTicker(asset.ticker_name!)
    if( exist && exist.uuid != uuid ) {
      throw Error("ALREADY_EXIST")
    }
    return this.assetRepository.patchAssetInfo(uuid, asset);
  }

  public async deleteAsset(uuid: string) {
    return this.assetRepository.removeAsset(uuid);
  }

  // ─── Custom asset methods (ported from HEAD branch) ───────────────────────

  public async getAllAssets(): Promise<AssetResponseDto[]> {
    const assets: Asset[] = await this.assetRepository.getAllAssets();
    return assets.map((a) => this.assetMapper.assetEntityToDto(a));
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

  public async createCustomAsset(ticker: string): Promise<AssetResponseDto> {
    const existing: Asset | null = await this.assetRepository.getAssetFromTicker(ticker);
    if (existing) {
      return this.assetMapper.assetEntityToDto(existing);
    }

    const quote = await this.yahooFinanceService.fetchAssetQuote(ticker);
    if (!quote) {
      throw new Error("TICKER_NOT_FOUND");
    }

    let currencyUuid: string | null = null;
    if (quote.currency) {
      const currency = await this.currenciesRepository.getByName(quote.currency);
      if (currency) currencyUuid = currency.uuid;
    }

    const asset: Asset = await this.assetRepository.addCustomAsset({
      ticker_name: quote.ticker,
      official_name: quote.officialName,
      base_currency_uuid: currencyUuid,
      asset_type: quote.assetType,
    });

    await this.syncCustomAssetDividends(asset.uuid, quote.ticker);

    this.syncCustomAssetPrices(asset.uuid, quote.ticker).catch((err) => {
      console.error(`[AssetService] Price sync failed for ${quote.ticker}:`, err instanceof Error ? err.message : String(err));
    });

    return this.assetMapper.assetEntityToDto(asset);
  }

  public async getAssetPrice(assetId: string, date: string): Promise<AssetPriceResponseDto | null> {
    const asset: Asset | null = await this.assetRepository.getAssetFromUUID(assetId);
    if (!asset) throw new Error("ASSET_NOT_FOUND");

    const targetDate: Date = new Date(date);
    let assetPrice: AssetPrice | null = await this.assetPriceRepository.getClosestPriceBeforeOrAt(assetId, targetDate);
    if (!assetPrice) {
      assetPrice = await this.assetPriceRepository.getLatestAssetPrice(assetId);
    }

    if (!assetPrice && asset.is_custom && asset.ticker_name) {
      const quote = await this.yahooFinanceService.fetchAssetQuote(asset.ticker_name);
      if (!quote || quote.price == null) return null;
      return {
        price: quote.price,
        date: new Date().toISOString().split("T")[0],
      };
    }

    if (!assetPrice) return null;
    return {
      price: assetPrice.asset_price,
      date: assetPrice.asset_price_date.toISOString().split("T")[0],
    };
  }

  private async syncCustomAssetDividends(assetUuid: string, ticker: string): Promise<void> {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const now = new Date();
    try {
      const dividends = await this.yahooFinanceService.fetchHistoricalDividends(ticker, fiveYearsAgo, now);
      if (dividends.length > 0) {
        await this.assetDividendRepository.bulkCreate(
          dividends.map((d) => ({ asset_uuid: assetUuid, dividend_amount: d.dividends, ex_date: d.date }))
        );
        console.log(`[AssetService] Stored ${dividends.length} dividends for custom asset ${ticker}`);
      }
    } catch (err) {
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
          prices.map((p) => ({ asset_uuid: assetUuid, asset_price_date: p.date, asset_price: p.price }))
        );
        console.log(`[AssetService] Stored ${prices.length} prices for custom asset ${ticker}`);
      }
    } catch (err) {
      console.error(`[AssetService] Price sync failed for ${ticker}:`, err instanceof Error ? err.message : String(err));
    }
  }
}
