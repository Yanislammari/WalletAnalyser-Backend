import { Op } from "sequelize";
import { Asset, attributesAsset, attributesAssetCluster, attributesPortfolio, Country, Sector } from "../../db_schema";
import { AssetRepository, PortfolioRepository, SectorRepository } from "../../repositories";
import { AssetClusterRepository } from "../../repositories/asset/asset_cluster.repository";
import { AssetType } from "../../dtos";
import { AssetPriceRepository } from '../../repositories/asset/asset_price.repository';

export class AssetClusterService {
  private readonly assetClusterRepository = new AssetClusterRepository()
  private readonly assetRepository = new AssetRepository()
  private readonly assetPriceRepository = new AssetPriceRepository()
  private readonly sectorRepository = new SectorRepository()
  private readonly portfolioRepository = new PortfolioRepository()
  constructor() {}

  async getPerf(asset_uuid : string){
    const todayPrice = 100;
    const lastYearPrice = Math.floor(Math.random() * 200 )+ 1;
    if (todayPrice <= 0 || lastYearPrice <= 0) return null;
    return ((lastYearPrice - todayPrice) / todayPrice)
    /**const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const todayPrice = await this.assetPriceRepository.getAssetPriceAtDate(asset_uuid, now);
    const lastYearPrice = await this.assetPriceRepository.getAssetPriceAtDate(asset_uuid, oneYearAgo);

    if (todayPrice == null || lastYearPrice == null || todayPrice.asset_price <= 0 || lastYearPrice.asset_price <= 0) return null;

    return ((lastYearPrice.asset_price - todayPrice.asset_price) / todayPrice.asset_price)**/
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
      const perf = await this.getPerf(asset.uuid)
      if(perf == null) continue

      const existing = sectorMap.get(sector_uuid);
      if (existing) {
        existing.totalPerf += perf;
        existing.count += 1;
        existing.assets.push({ asset, perf: perf * 100});
      } else {
        sectorMap.set(sector_uuid, { totalPerf: perf, count: 1, assets: [{ asset, perf: perf * 100  }] });
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
    const sectorMap = new Map<number, { totalPerf: number; count: number; assets: { asset: Asset; perf: number }[] }>();

    for (const assetCluster of assetsCluster) {
      const cluster_id = assetCluster.cluster;
      const perf = await this.getPerf(assetCluster.uuid)
      if(perf == null) continue

      const existing = sectorMap.get(cluster_id);
      if (existing) {
        existing.totalPerf += perf;
        existing.count += 1;
        const asset = assetCluster.asset
        existing.assets.push({ asset, perf: perf * 100 });
      } else {
        const asset = assetCluster.asset
        sectorMap.set(cluster_id, { totalPerf: perf, count: 1, assets: [{ asset, perf: perf * 100  }] });
      }
    }

    const result = await Promise.all(
      Array.from(sectorMap.entries()).map(async ([unique_key, { totalPerf, count, assets }]) => {
        const sorted = assets.sort((a, b) => b.perf - a.perf);  
        return {
          unique_key,
          length: count,
          mean_perf: ((totalPerf / count) * 100),
          best_performers: sorted.slice(0, 3),
          worst_performers: sorted.slice(-3),
        };
      })
    );
    result.sort((a,b) => b.mean_perf - a.mean_perf)

    return result;
  }

  private async getRankInSector(asset: Asset): Promise<{asset : Asset, rank : string, perf : number, rank_position : number} | null> {
    const sectorAssets = await this.assetRepository.get({
      where: { [attributesAsset.sector_uuid]: asset.sector_uuid },
      attributes : [attributesAsset.uuid]
    });

    const assetsPerfs = (await Promise.all(
      sectorAssets.map(async (asset) => {
        const perf = await this.getPerf(asset.uuid);
        if (perf == null) return null;
        return { uuid: asset.uuid, perf};
      })
    )).filter((item) => item !== null);

    if(assetsPerfs.length == 0) {
      return null
    }

    assetsPerfs.sort((a,b) => b.perf - a.perf)

    const position = assetsPerfs.findIndex(a => a.uuid === asset.uuid) + 1;

    return {
      asset: asset,
      rank: `${position}/${sectorAssets.length}`,
      rank_position: position,
      perf: assetsPerfs[position - 1].perf * 100
    };
  }

  async getUserStocksSummary(portfolio_id : string) {
    //mock assets
    const msft = await this.assetRepository.getAssetFromTicker("MSFT")
    const unh = await this.assetRepository.getAssetFromTicker("UNH")
    const JD = await this.assetRepository.getAssetFromTicker("JD")
    const ASML = await this.assetRepository.getAssetFromTicker("ASML")
    const assets =  [msft, unh, ASML, JD]
    //mock assets
    const results = await Promise.all(
      assets.map(async (asset) => {
        const fullAsset = await this.assetRepository.getAssetsFull(asset?.uuid ?? "")
        if(fullAsset == null) return
        return await this.getRankInSector(fullAsset)
      })
    )
    const clean = results.filter((item) => item !== null && item != null)
    clean.sort((a,b) => b.perf - a.perf)
    return clean
  }

  private async getDetailsWholeSector(assets : Asset[]) {
    const assetsPerfs = (await Promise.all( // add country, sector, cluster_position
      assets.map(async (asset) => {
        const perf = await this.getPerf(asset.uuid);
        if (perf == null) return null;
        return { asset, perf : perf * 100};
      })
    )).filter((item) => item !== null);

    assetsPerfs.sort((a,b) => b.perf - a.perf)

    return assetsPerfs.map((item, index) => ({ ...item, rank_position: index + 1 }));
  }

  async getSectorDetails(sector_uuid : string){
    const assetsFull = await this.assetRepository.assetFullPerSector(sector_uuid)
    return await this.getDetailsWholeSector(assetsFull)
  }

  async getClusterDetails(cluster_uuid : string){
    const cluster_id = parseInt(cluster_uuid, 10);
    if (isNaN(cluster_id)) throw new Error(`NOT_A_NUMBER`);
    const assetsCluster = await this.assetClusterRepository.get({
      where : { [attributesAssetCluster.cluster] : cluster_id}
    })
    const assetsFull = await Promise.all(
      assetsCluster.map(cluster => this.assetRepository.getAssetsFull(cluster.asset_uuid))
    );
    const clean = assetsFull.filter((item) => item !== null)
    return await this.getDetailsWholeSector(clean)
  }

  async getSectorName(sector_uuid : string){
    const sector = await this.sectorRepository.getById(sector_uuid)
    return sector?.sector_name ?? "Unknown Sector"
  }
}
