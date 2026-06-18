import { includes } from "zod";
import { Asset, AssetCluster, attributesAsset } from "../../db_schema";
import { BaseRepository } from "../base.repository";
import { AssetRepository } from "./asset.repository";
import { Op } from "sequelize";
import { AssetType } from "../../dtos";

export class AssetClusterRepository extends BaseRepository<AssetCluster> {
  private readonly assetRepository = new AssetRepository()
  constructor() {
    super(AssetCluster);
  }

  async getAllAssetClusters() {
    const assetClusters = await AssetCluster.findAll({
      include: [{
        model: Asset,
        as: "asset",
        attributes : [attributesAsset.uuid, attributesAsset.display_name, attributesAsset.sector_uuid, attributesAsset.asset_type],
        where : {
          [attributesAsset.sector_uuid] : {[Op.not] : null},
          [attributesAsset.asset_type] : AssetType.STOCKS
        },
        required : true
      }],
  })
    return assetClusters
  }
}
