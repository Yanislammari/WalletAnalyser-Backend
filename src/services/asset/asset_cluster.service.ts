import { Op } from "sequelize";
import { Asset, attributesAsset, attributesAssetCluster } from "../../db_schema";
import { AssetRepository, CountryRepository, SectorRepository } from "../../repositories";
import { AssetClusterRepository } from "../../repositories/asset/asset_cluster.repository";
import { AssetType } from "../../dtos";
import { AssetPriceRepository } from '../../repositories/asset/asset_price.repository';
import { PortfolioService } from "../portfolio/portfolio.service";
import { RankAsset } from "../../dtos/asset/ranking/rank";
import { sl } from "zod/locales";

export class AssetClusterService {
  private readonly assetClusterRepository = new AssetClusterRepository()
  private readonly assetRepository = new AssetRepository()
  private readonly assetPriceRepository = new AssetPriceRepository()
  private readonly sectorRepository = new SectorRepository()
  private readonly countryRepository = new CountryRepository()
  private readonly portfolioService = new PortfolioService()
  constructor() {}

  async getPerf(asset_uuid : string){
    const todayPrice = 100;
    const lastYearPrice = Math.floor(Math.random() * 200 )+ 1;
    if (todayPrice <= 0 || lastYearPrice <= 0) return null;
    return ((lastYearPrice - todayPrice) / todayPrice) * 100
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
        existing.assets.push({ asset, perf: perf});
      } else {
        sectorMap.set(sector_uuid, { totalPerf: perf, count: 1, assets: [{ asset, perf: perf }] });
      }
    }

    const result = await Promise.all(
      Array.from(sectorMap.entries()).map(async ([unique_key, { totalPerf, count, assets }]) => {
        const sector = await this.sectorRepository.getById(unique_key);
        const sorted = assets.sort((a, b) => b.perf - a.perf); 
        return {
          sector,
          length: count,
          mean_perf: (totalPerf / count),
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
    const clusterMap = new Map<number, { totalPerf: number; count: number; assets: { asset: Asset; perf: number }[] }>();

    for (const assetCluster of assetsCluster) {
      const cluster_id = assetCluster.cluster;
      const perf = await this.getPerf(assetCluster.uuid)
      if(perf == null) continue

      const existing = clusterMap.get(cluster_id);
      if (existing) {
        existing.totalPerf += perf;
        existing.count += 1;
        const asset = assetCluster.asset
        existing.assets.push({ asset, perf: perf });
      } else {
        const asset = assetCluster.asset
        clusterMap.set(cluster_id, { totalPerf: perf, count: 1, assets: [{ asset, perf: perf  }] });
      }
    }

    const result = await Promise.all(
      Array.from(clusterMap.entries()).map(async ([unique_key, { totalPerf, count, assets }]) => {
        const sorted = assets.sort((a, b) => b.perf - a.perf);  
        return {
          unique_key,
          length: count,
          mean_perf: totalPerf / count,
          best_performers: sorted.slice(0, 3),
          worst_performers: sorted.slice(-3),
        };
      })
    );
    result.sort((a,b) => b.mean_perf - a.mean_perf)

    return result;
  }

  async getCountriesSummary(){
    const allAssets = await this.assetRepository.get({
        where : {
          [attributesAsset.country_uuid] : {[Op.not] : null},
          [attributesAsset.asset_type] : AssetType.STOCKS
        }
    },
      [attributesAsset.uuid, attributesAsset.display_name, attributesAsset.country_uuid]
    )
    const countryMap = new Map<string, { totalPerf: number; count: number; assets: { asset: Asset; perf: number }[] }>();

    for (const asset of allAssets) {
      const country_uuid = asset.country_uuid;
      const perf = await this.getPerf(asset.uuid)
      if(perf == null) continue

      const existing = countryMap.get(country_uuid);
      if (existing) {
        existing.totalPerf += perf;
        existing.count += 1;
        existing.assets.push({ asset, perf: perf});
      } else {
        countryMap.set(country_uuid, { totalPerf: perf, count: 1, assets: [{ asset, perf: perf }] });
      }
    }

    const result = await Promise.all(
      Array.from(countryMap.entries()).map(async ([unique_key, { totalPerf, count, assets }]) => {
        const country = await this.countryRepository.getById(unique_key);
        const sorted = assets.sort((a, b) => b.perf - a.perf); 
        return {
          country,
          length: count,
          mean_perf: totalPerf / count,
          best_performers: sorted.slice(0, 3),
          worst_performers: sorted.slice(-3),
        };
      })
    );
    result.sort((a,b) => b.mean_perf - a.mean_perf)
    return result;
  }

  private async getPerfAll(assets:Asset[]) {
    return (await Promise.all(
      assets.map(async (asset) => {
        const perf = await this.getPerf(asset.uuid);
        if (perf == null) return null;
        return { asset, perf};
      })
    )).filter((item) => item !== null);
  }

  private async getRankInAny(assets: Asset[]): Promise<RankAsset[] | null> {
    const assetsSectors = await this.assetRepository.getAllAssetOfSector();
    const assetsCountries = await this.assetRepository.getAllAssetOfCountry();
    const clusters = await this.assetClusterRepository.getAllAssetClusters();
    const assetsCluster = (await Promise.all(
      clusters.map((cluster) => this.assetRepository.getAssetOfCluster(cluster.asset_uuid))
    )).filter((item) => item != null);

    const assetsPerfs = await this.getPerfAll(assets);
    if (assetsPerfs.length == 0) return null;
    assetsPerfs.sort((a,b) => b.perf - a.perf)

    const [sectorGroups, countryGroups, clusterGroups] = await Promise.all([
      this.buildRankGroups(assetsSectors, (a) => a.sector_uuid),
      this.buildRankGroups(assetsCountries, (a) => a.country_uuid),
      this.buildRankGroups(assetsCluster, (a) => a.cluster?.cluster ?? null),
    ]);

    return assetsPerfs.map((item) => {
      const sector = this.getRankAndPosition(sectorGroups, item.asset.sector_uuid, item);
      const country = this.getRankAndPosition(countryGroups, item.asset.country_uuid, item);
      const cluster = this.getRankAndPosition(clusterGroups, item.asset.cluster?.cluster, item);

      return {
        asset: item.asset,
        perf: item.perf,
        rank_sector: sector.rank,
        rank_sector_position: sector.position,
        rank_country: country.rank,
        rank_country_position: country.position,
        rank_cluster: cluster.rank,
        rank_cluster_position: cluster.position,
      };
    });
  }

  // Fetches perfs for a universe, sorts by perf desc, and groups by key
  private async buildRankGroups<K>(
    universeAssets: Asset[],
    keyFn: (asset: Asset) => K | null | undefined
  ): Promise<Map<K, { asset: Asset; perf: number }[]>> {
    const perfs = await this.getPerfAll(universeAssets);
    perfs.sort((a, b) => b.perf - a.perf);

    const groups = new Map<K, { asset: Asset; perf: number }[]>();
    for (const item of perfs) {
      const key = keyFn(item.asset);
      if (key == null) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return groups;
  }

  // Looks up an item's rank within its group, returns null-safe rank + "x/y" position
  private getRankAndPosition<K, T extends { asset: Asset }>(
    groups: Map<K, T[]>,
    key: K | null | undefined,
    item: T
  ): { rank: number | null; position: string | null } {
    if (key == null) return { rank: null, position: null };
    const group = groups.get(key);
    if (!group) return { rank: null, position: null };

    const idx = group.findIndex((g) => g.asset.uuid === item.asset.uuid);
    if (idx === -1) return { rank: null, position: null };

    const rank = idx + 1;
    return { rank, position: `${rank}/${group.length}` };
  }

  async getUserStocksSummary(portfolio_id : string) {
    const holdings = await this.portfolioService.holdingsInPortfolio(portfolio_id)
    
    const assetsFull = await Promise.all(
      holdings.map(holding => this.assetRepository.getAssetsFull(holding.assetId))
    );
    const clean = assetsFull.filter(
      (item): item is NonNullable<typeof item> =>
        item !== null && item.asset_type != AssetType.ETF
    );
    return await this.getRankInAny(clean);
  }

  async getSectorDetails(sector_uuid : string){
    const assetsSector = await this.assetRepository.getAssetsOfSector(sector_uuid)
    const assetsFull = await Promise.all(
      assetsSector.map(asset => this.assetRepository.getAssetsFull(asset.uuid))
    );
    const clean = assetsFull.filter((item) => item !== null)
    return await this.getRankInAny(clean)
  }

  async getCountriesDetails(country_uuid : string){
    const assetsCountries = await this.assetRepository.getAssetsOfCountry(country_uuid)
    const assetsFull = await Promise.all(
      assetsCountries.map(asset => this.assetRepository.getAssetsFull(asset.uuid))
    );
    const clean = assetsFull.filter((item) => item !== null)
    return await this.getRankInAny(clean)
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
    return await this.getRankInAny(clean)
  }

  async getSectorName(sector_uuid : string){
    const sector = await this.sectorRepository.getById(sector_uuid)
    return sector?.sector_name ?? "Unknown Sector"
  }

  async getCountryName(country_uuid : string){
    const country = await this.countryRepository.getById(country_uuid)
    return country?.country_name ?? "Unknown country"
  }
}
