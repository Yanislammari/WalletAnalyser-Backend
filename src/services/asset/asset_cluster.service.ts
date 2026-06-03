import { AssetRepository } from "../../repositories";
import { AssetClusterRepository } from "../../repositories/asset/asset_cluster.repository";

export class AssetClusterService {
  private readonly assetClusterRepository = new AssetClusterRepository()
  private readonly assetRepository = new AssetRepository()
  constructor() {}

  
}
