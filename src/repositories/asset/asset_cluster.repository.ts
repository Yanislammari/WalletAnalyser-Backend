import { AssetCluster } from "../../db_schema";
import { BaseRepository } from "../base.repository";
import { AssetRepository } from "./asset.repository";

export class AssetClusterRepository extends BaseRepository<AssetCluster> {
  private readonly assetRepository = new AssetRepository()
  constructor() {
    super(AssetCluster);
  }
}
