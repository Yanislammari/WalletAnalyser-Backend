import { Op } from "sequelize";
import { Asset, attributesAsset } from "../../db_schema";
import { AssetDatabaseModel } from "../../models";
import { BaseRepository } from "../base.repository";

export class AssetRepository extends BaseRepository<Asset> {
  constructor() {
    super(Asset)
  }

  async getAllAssets(): Promise<Asset[]> {
    try {
      const assets = await Asset.findAll();
      return assets;
    } catch (error) {
      console.error("Error fetching all assets from the database:", error);
      return [];
    }
  }

  async getAssetFromUUID(uuid: string): Promise<Asset | null> {
    try {
      const existingAsset =
        (await Asset.findOne({
          where: {
            [attributesAsset.uuid]: uuid,
          },
        })) || null;
      return existingAsset;
    } catch (error) {
      console.error(`Error fetching asset with uuid ${uuid} from the database:`, error);
      return null;
    }
  }

  async getClosestAssetFromOfficialName(officialNameAllias: string): Promise<Asset | null> {
    try {
      const existingAsset =
        (await Asset.findOne({
          where: {
            [attributesAsset.official_name]: {
              [Op.iLike]: `%${officialNameAllias}%`,
            },
          },
        })) || null;
      return existingAsset;
    } catch (error) {
      console.error(`Error fetching asset with officialName ${officialNameAllias} from the database:`, error);
      return null;
    }
  }

  async getAssetFromOfficialName(officialName: string): Promise<Asset | null> {
    try {
      const existingAsset =
        (await Asset.findOne({
          where: {
            [attributesAsset.official_name]: {
              [Op.iLike]: officialName,
            },
          },
        })) || null;
      return existingAsset;
    } catch (error) {
      console.error(`Error fetching asset with officialName ${officialName} from the database:`, error);
      return null;
    }
  }

  async getAssetFromTicker(ticker: string): Promise<Asset | null> {
    try {
      const existingAsset =
        (await Asset.findOne({
          where: {
            [attributesAsset.ticker_name]: {
              [Op.iLike]: ticker,
            },
          },
        })) || null;
      return existingAsset;
    } catch (error) {
      console.error(`Error fetching asset with ticker ${ticker} from the database:`, error);
      return null;
    }
  }

  async addAssetFromAssetToDatabase(asset: AssetDatabaseModel): Promise<Asset> {
    try {
      if (asset.ticker_name === null && asset.official_name === null) {
        throw new Error("Both ticker_name and official_name cannot be null");
      }
      const existingAsset = await this.getAssetFromTicker(asset.ticker_name ?? "");
      if (existingAsset) {
        return existingAsset;
      }
      const existingAssetByOfficialName = await this.getAssetFromOfficialName(asset.official_name ?? "");
      if (existingAssetByOfficialName) {
        return existingAssetByOfficialName;
      }
      const newAsset = await Asset.create({
        [attributesAsset.base_currency_uuid]: asset.base_currency_uuid,
        [attributesAsset.asset_type]: asset.asset_type,
        [attributesAsset.official_name]: asset.official_name,
        [attributesAsset.ticker_name]: asset.ticker_name,
        [attributesAsset.sector_uuid]: asset.sector_uuid,
        [attributesAsset.country_uuid]: asset.country_uuid,
      });
      return newAsset;
    } catch (error) {
      console.error(`Error adding ticker ${asset.ticker_name} to database:`, error);
      throw error;
    }
  }

  async patchCurrencyUUIDAsset(asset_uuid: string, base_currency_uuid: string | null): Promise<Asset | null> {
    try {
      await Asset.update(
        {
          [attributesAsset.base_currency_uuid]: base_currency_uuid,
        },
        {
          where: {
            [attributesAsset.uuid]: asset_uuid,
          },
        }
      );
      const updatedAsset = await this.getAssetFromUUID(asset_uuid);
      return updatedAsset;
    } catch (error) {
      console.error(`Error patching asset with uuid ${asset_uuid} in the database:`, error);
      return null;
    }
  }

  async patchAssetInfo(asset_uuid: string, asset: AssetDatabaseModel): Promise<Asset | null> {
    try {
      await Asset.update(
        {
          [attributesAsset.base_currency_uuid]: asset.base_currency_uuid,
          [attributesAsset.asset_type]: asset.asset_type,
          [attributesAsset.official_name]: asset.official_name,
          [attributesAsset.ticker_name]: asset.ticker_name,
          [attributesAsset.sector_uuid]: asset.sector_uuid,
          [attributesAsset.country_uuid]: asset.country_uuid,
        },
        {
          where: {
            [attributesAsset.uuid]: asset_uuid,
          },
        }
      );
      const updatedAsset = await this.getAssetFromUUID(asset_uuid);
      return updatedAsset;
    } catch (error) {
      console.error(`Error patching asset with uuid ${asset_uuid} in the database:`, error);
      return null;
    }
  }

  async removeAsset(asset_uuid: string): Promise<boolean> {
    try {
      const asset = await this.getAssetFromUUID(asset_uuid);
      if (!asset) {
        return false;
      }
      await asset.destroy();
      return true;
    } catch (error) {
      console.error(`Error deleting asset with uuid ${asset_uuid} from the database:`, error);
      return false;
    }
  }

  async getAssets(type?: string, offset = 0, limit = 100, search?: string): Promise<{ assets: Asset[]; length: number }> {
    try {
      const where: any = {};

      if (type) {
        where[attributesAsset.asset_type] = type;
      }

      if (search) {
        where[Op.or] = [
          {
            [attributesAsset.ticker_name]: {
              [Op.iLike]: `%${search}%`,
            },
          },
          {
            [attributesAsset.official_name]: {
              [Op.iLike]: `%${search}%`,
            },
          },
        ];
      }

      const result = await Asset.findAndCountAll({
        where,
        limit,
        offset,
        order: [[attributesAsset.official_name, "ASC"]],
      });

      return {
        assets: result.rows,
        length: result.count,
      };
    } catch (error) {
      console.error("Error fetching assets from the database:", error);
      return {
        assets: [],
        length: 0,
      };
    }
  }
}
