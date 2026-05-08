import { AssetRepository } from "./../repositories/asset/asset.repository";
import { AssetDatabaseModel } from "../models";
import { Asset, attributesAsset } from "../db_schema";
import { Op } from "sequelize";
import { AssetShort, MetaDataAssets, MetaDataAssetShort } from "../dtos";
import { AssetPriceRepository } from "../repositories";
import { sequelize } from "../config";
import { uuid } from "zod";

export class AssetService {
  private readonly assetRepository: AssetRepository;
  private readonly assetPriceRepository: AssetPriceRepository;

  constructor() {
    this.assetRepository = new AssetRepository();
    this.assetPriceRepository = new AssetPriceRepository();
  }

  public async getAssets(type?: string, offset = 0, limit = 100, search?: string): Promise<MetaDataAssets> {
    const assets : Asset[] = await this.assetRepository.get({
      where: {
        [attributesAsset.asset_type] : { [Op.in]: [type] },
        [attributesAsset.official_name]: { [Op.startsWith]: search }
      },
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

    const length = (await this.assetRepository.get({
      where: {
        [attributesAsset.asset_type] : { [Op.in]: [type] },
        [attributesAsset.official_name]: { [Op.startsWith]: search }
      },
    })).length
    return { length , assets :  metaDataAssets }
  }

  public async createAsset(asset: AssetDatabaseModel) : Promise<AssetShort> {
    return this.assetRepository.addAssetFromAssetToDatabase(asset);
  }

  public async updateAsset(uuid: string, asset: AssetDatabaseModel): Promise<AssetShort | null> {
    return this.assetRepository.patchAssetInfo(uuid, asset);
  }

  public async deleteAsset(uuid: string) {
    return this.assetRepository.removeAsset(uuid);
  }
}
