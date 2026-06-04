import { Op } from "sequelize";
import { Asset, attributesAsset } from "../../db_schema";
import { AssetRepository, SectorRepository } from "../../repositories";
import { AssetClusterRepository } from "../../repositories/asset/asset_cluster.repository";
import { AssetType } from "../../dtos";

export class AssetClusterService {
  private readonly assetClusterRepository = new AssetClusterRepository()
  private readonly assetRepository = new AssetRepository()
  private readonly sectorRepository = new SectorRepository()
  constructor() {}

  getPerf(asset_uuid : string){
    const todayPrice = 100;
    const lastYearPrice = Math.floor(Math.random() * 1000);

    if (todayPrice <= 0 || lastYearPrice <= 0) return null;

    return (todayPrice - lastYearPrice) / lastYearPrice;
  }

  async getSectorSummary(){
    const allAssets = await this.assetRepository.get({
        where : {
          [attributesAsset.sector_uuid] : {[Op.not] : null},
          [attributesAsset.asset_type] : AssetType.STOCKS
        }
    },
      [attributesAsset.uuid, attributesAsset.display_name, attributesAsset.sector_uuid]
    )
    const sectorMap = new Map<string, { totalPerf: number; count: number; assets: { asset: Asset; perf: number }[] }>();

    for (const asset of allAssets) {
      const sector_uuid = asset.sector_uuid;
      const perf = this.getPerf(asset.uuid)
      if(perf == null) continue

      const existing = sectorMap.get(sector_uuid);
      if (existing) {
        existing.totalPerf += perf;
        existing.count += 1;
        existing.assets.push({ asset, perf });
      } else {
        sectorMap.set(sector_uuid, { totalPerf: perf, count: 1, assets: [{ asset, perf }] });
      }
    }

    const result = await Promise.all(
      Array.from(sectorMap.entries()).map(async ([unique_key, { totalPerf, count, assets }]) => {
        const sector = await this.sectorRepository.getById(unique_key);
        const sorted = assets.sort((a, b) => b.perf - a.perf); 
        return {
          sector,
          length: count,
          mean_perf: (totalPerf / count) * 100,
          best_performers: sorted.slice(0, 3),
          worst_performers: sorted.slice(-3),
        };
      })
    );
    result.sort((a,b) => b.mean_perf - a.mean_perf)

    return result;
  }

  async getClusterSummary(){
    const assetsCluster = await this.assetClusterRepository.getAllAssetClusters()
    console.log(assetsCluster)
    const sectorMap = new Map<number, { totalPerf: number; count: number; assets: { asset: Asset; perf: number }[] }>();

    for (const assetCluster of assetsCluster) {
      const cluster_id = assetCluster.cluster;
      const perf = this.getPerf(assetCluster.uuid)
      if(perf == null) continue

      const existing = sectorMap.get(cluster_id);
      if (existing) {
        existing.totalPerf += perf;
        existing.count += 1;
        const asset = assetCluster.asset
        existing.assets.push({ asset, perf });
      } else {
        const asset = assetCluster.asset
        sectorMap.set(cluster_id, { totalPerf: perf, count: 1, assets: [{ asset, perf }] });
      }
    }

    const result = await Promise.all(
      Array.from(sectorMap.entries()).map(async ([unique_key, { totalPerf, count, assets }]) => {
        const sorted = assets.sort((a, b) => b.perf - a.perf); 
        return {
          unique_key,
          length: count,
          mean_perf: (totalPerf / count) * 100,
          best_performers: sorted.slice(0, 3),
          worst_performers: sorted.slice(-3),
        };
      })
    );
    result.sort((a,b) => b.mean_perf - a.mean_perf)

    return result;
  }

  async getSectorDetails(sector_uuid : string){

  }
}
