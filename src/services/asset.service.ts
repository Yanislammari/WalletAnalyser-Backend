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
    return this.assetRepository.addAssetFromAssetToDatabase(asset);
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
}
