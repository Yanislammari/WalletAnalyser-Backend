import { AssetPriceRepository, AssetRepository } from "../../repositories";
import { AssetPrice, attributesAssetPrice } from "../../db_schema";
import { MetaDataAssetPrice } from "../../dtos/asset/asset_price";
import { Op } from "sequelize";
import { DateService } from "./../date.service";
import { MarketstackController } from '../../controllers/marketstack/marketstack.controller';
import { AssetPriceCompletModel, AssetPriceModel } from "../../models";

export class AssetPriceService {
  private readonly assetPriceRepository: AssetPriceRepository;
  private readonly assetRepository : AssetRepository;
  private readonly dateService : DateService;
  private readonly marketstackController : MarketstackController

  constructor() {
    this.assetPriceRepository = new AssetPriceRepository();
    this.assetRepository = new AssetRepository();
    this.dateService = new DateService();
    this.marketstackController = new MarketstackController();
  }

  public async getAllAssetPrices(asset_uuid: string, offset: number, limit: number, from: Date | null,to: Date | null ): Promise<MetaDataAssetPrice> {
    const asset = await this.assetRepository.getById(asset_uuid)
    if(!asset){
      throw new Error("NO_ASSET")
    }
    const where: any = {[attributesAssetPrice.asset_uuid]: asset_uuid}
    if (from || to) {
      where[attributesAssetPrice.asset_price_date] = {}
      if (from) {
        where[attributesAssetPrice.asset_price_date][Op.gte] = from
      }

      if (to) {
        where[attributesAssetPrice.asset_price_date][Op.lte] = to
      }
    }
    const asset_prices = await this.assetPriceRepository.get({
        where,
        offset : offset,
        limit : limit,
        order: [[attributesAssetPrice.asset_price_date, "DESC"]],
    })
    const length = (await this.assetPriceRepository.get({where})).length
    return {length, asset, asset_prices};
  }

  public async createAssetPrice(asset_uuid: string, asset_price_date: Date, asset_price: number): Promise<AssetPrice> {
    const existingAssetPrice = await this.assetPriceRepository.getAssetPriceAtDate(asset_uuid, asset_price_date);
    if (existingAssetPrice) {
      throw new Error("EXIST");
    }

    return this.assetPriceRepository.addAssetPrice(asset_uuid, asset_price_date, asset_price);
  }

  public async updateAssetPricesFromApi( asset_uuid : string): Promise<number> {
    const asset = await this.assetRepository.getById(asset_uuid)
    if(!asset){
      throw new Error("NO_ASSET")
    }
    const isTickerUpToDate = await this.dateService.isAssetPriceUpToDate(asset.ticker_name);
    if (isTickerUpToDate) {
      return 0;
    }
    const assetPrice = await this.marketstackController.fetchHistoricalData(asset.ticker_name);
    const numberOfEntry = await this.addPricesToDatabase(assetPrice, asset_uuid)
    return numberOfEntry
  }

  public async addPricesToDatabase(assetPrice: (AssetPriceCompletModel | AssetPriceModel)[], asset_uuid : string) : Promise<number> {
    const latestPrice = await this.assetPriceRepository.getLatestAssetPrice(asset_uuid);
    let latestDate = new Date(0);
    let numberOfEntry = 0;
    if (latestPrice) {
      latestDate = latestPrice.asset_price_date;
    }
    let i = 0;
    while (i < assetPrice.length && assetPrice[i].date > latestDate) {
      if (isNaN(assetPrice[i].adj_close) || assetPrice[i].adj_close == 0) {
        i++;
        continue;
      }
      numberOfEntry++;
      await this.assetPriceRepository.addAssetPrice(asset_uuid, assetPrice[i].date, assetPrice[i].adj_close);
      i++;
    }
    return numberOfEntry
  }

  public async updateAssetPrice(
    uuid: string,
    updateData: { asset_price_date?: Date; asset_price?: number }
  ): Promise<AssetPrice | null> {
    if (updateData.asset_price_date) {
      const currentPrice = await this.assetPriceRepository.getAssetPriceByUuid(uuid);
      if (currentPrice && currentPrice.asset_price_date.getTime() !== updateData.asset_price_date.getTime()) {
        const existingAssetPrice = await this.assetPriceRepository.getAssetPriceAtDate(
          currentPrice.asset_uuid,
          updateData.asset_price_date
        );
        if (existingAssetPrice) {
          throw new Error("EXIST");
        }
      }
    }
    return this.assetPriceRepository.updateAssetPrice(uuid, updateData);
  }

  public async deleteAssetPrice(uuid: string): Promise<boolean> {
    return this.assetPriceRepository.deleteAssetPrice(uuid);
  }
}
