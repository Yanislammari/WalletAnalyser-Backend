import { Op } from "sequelize";
import { AssetPrice, attributesAssetPrice } from "../../db_schema";
import { BaseRepository } from "../base.repository";

export class AssetPriceRepository extends BaseRepository<AssetPrice> {
  constructor() {
    super(AssetPrice)
  }

  async getAssetPriceAtDate(assetUuid: string, dateOfPrice: Date): Promise<AssetPrice | null> {
    try {
      const existingAssetPrice =
        (await AssetPrice.findOne({
          where: {
            [attributesAssetPrice.asset_price_date]: dateOfPrice,
            [attributesAssetPrice.asset_uuid]: assetUuid,
          },
        })) || null;
      return existingAssetPrice;
    } catch (error) {
      console.error("Error fetching the price on a spe date:", error);
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

  async getAssetPriceByUuid(uuid: string): Promise<AssetPrice | null> {
    try {
      const assetPrice =
        (await AssetPrice.findOne({
          where: {
            [attributesAssetPrice.uuid]: uuid,
          },
        })) || null;
      return assetPrice;
    } catch (error) {
      console.error(`Error fetching asset price with uuid ${uuid} from the database:`, error);
      throw error;
    }
  }

  async updateAssetPrice(
    uuid: string,
    updateData: { asset_price_date?: Date; asset_price?: number }
  ): Promise<AssetPrice | null> {
    try {
      const assetPrice = await this.getAssetPriceByUuid(uuid);
      if (!assetPrice) {
        return null;
      }

      if (updateData.asset_price_date) {
        assetPrice.asset_price_date = updateData.asset_price_date;
      }
      if (updateData.asset_price !== undefined) {
        assetPrice.asset_price = updateData.asset_price;
      }

      await assetPrice.save();
      return assetPrice;
    } catch (error) {
      console.error(`Error updating asset price with uuid ${uuid} in the database:`, error);
      throw error;
    }
  }

  async deleteAssetPrice(uuid: string): Promise<boolean> {
    try {
      const assetPrice = await this.getAssetPriceByUuid(uuid);
      if (!assetPrice) {
        return false;
      }
      await assetPrice.destroy();
      return true;
    } catch (error) {
      console.error(`Error deleting asset price with uuid ${uuid} from the database:`, error);
      throw error;
    }
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
