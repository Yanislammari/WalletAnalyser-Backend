import { Op } from "sequelize";
import { AssetPrice, attributesAssetPrice } from "../../db_schema";

export class AssetPriceRepository {
  constructor() {}

  async getAssetPriceAtDate(assetUuid: string, dateOfPrice: Date): Promise<AssetPrice | null> {
    try {
      const existingAssetPrice =
        AssetPrice.findOne({
          where: {
            [attributesAssetPrice.asset_price_date]: dateOfPrice,
            [attributesAssetPrice.asset_uuid]: assetUuid,
          },
        }) || null;
      return existingAssetPrice;
    } catch (error) {
      console.error("Error fetching the price on a spe date:", error);
      throw error;
    }
  }

  async getClosestPriceBeforeOrAt(assetUuid: string, date: Date): Promise<AssetPrice | null> {
    try {
      return await AssetPrice.findOne({
        where: {
          [attributesAssetPrice.asset_uuid]: assetUuid,
          [attributesAssetPrice.asset_price_date]: { [Op.lte]: date },
        },
        order: [[attributesAssetPrice.asset_price_date, "DESC"]],
      });
    }
    catch (error) {
      throw error;
    }
  }

  async getLatestAssetPrice(assetUuid: string): Promise<AssetPrice | null> {
    try {
      const latestPrice = await AssetPrice.findOne({
        where: {
          [attributesAssetPrice.asset_uuid]: assetUuid,
        },
        order: [
          [attributesAssetPrice.asset_price_date, "DESC"], // newest first
        ],
      });
      return latestPrice;
    } catch (error) {
      console.error("Error fetching the latest asset price from the database:", error);
      throw error;
    }
  }

  async bulkCreatePrices(records: Array<{ asset_uuid: string; asset_price_date: Date; asset_price: number }>): Promise<void> {
    if (records.length === 0) return;
    await AssetPrice.bulkCreate(records as any, { ignoreDuplicates: true });
  }

  async addAssetPrice(assetUuid: string, date: Date, price: number): Promise<AssetPrice> {
    try {
      const exisitingAssetPrice = await this.getAssetPriceAtDate(assetUuid, date);
      if (exisitingAssetPrice) {
        return exisitingAssetPrice;
      }
      const addedAssetPrice = AssetPrice.create({
        [attributesAssetPrice.asset_uuid]: assetUuid,
        [attributesAssetPrice.asset_price_date]: date,
        [attributesAssetPrice.asset_price]: price,
      });
      return addedAssetPrice;
    } catch (error) {
      console.error(`Error adding price of asset : ${assetUuid} to database:`, error);
      throw error;
    }
  }
}
