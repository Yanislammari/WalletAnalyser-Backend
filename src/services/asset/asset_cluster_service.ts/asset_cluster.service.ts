import { Asset } from "../../../db_schema";
import { CountryRepository, SectorRepository } from "../../../repositories";
import { AssetType } from "../../../dtos";
import { PortfolioService } from "../../portfolio/portfolio.service";
import { RankAsset } from "../../../dtos/asset/ranking/rank";
import { AssetClusterCachingService } from './asset_cluster_caching_service';
import { AssetPerf } from "../../../models/ranking";

export class AssetClusterService {
  private static instance: AssetClusterService;

  private readonly sectorRepository = new SectorRepository();
  private readonly countryRepository = new CountryRepository();
  private readonly portfolioService = new PortfolioService();
  private readonly assetClusterCachingService = AssetClusterCachingService.getInstance()

  private constructor() {}

  static getInstance(): AssetClusterService {
    if (!AssetClusterService.instance) {
      AssetClusterService.instance = new AssetClusterService();
    }
    return AssetClusterService.instance;
  }

  async getSectorSummary(){
    const perfs = await this.assetClusterCachingService.getCachedPerfAll();
    const filteredPerfs = perfs.filter((item) => item.asset.asset_type == AssetType.STOCKS && item.asset.sector_uuid && item.perf != null);
    const sectorMap = new Map<string, { totalPerf: number; count: number; assets: { asset: Asset; perf: number }[] }>();

    for (const { asset, perf } of filteredPerfs) {
      const sector_uuid = asset.sector_uuid;
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
          mean_perf: totalPerf / count,
          best_performers: sorted.slice(0, 3),
          worst_performers: sorted.slice(-3),
        };
      })
    );
    result.sort((a, b) => b.mean_perf - a.mean_perf);

    return result;
  }

  async getClusterSummary(){
    const perfs = await this.assetClusterCachingService.getCachedPerfAll()
    const filteredPerfs = perfs.filter((item) => item.asset.cluster?.cluster != null && item.perf != null);
    const clusterMap = new Map<number, { totalPerf: number; count: number; assets: { asset: Asset; perf: number }[] }>();
    for (const { asset, perf } of filteredPerfs) {
      const cluster_id = asset.cluster.cluster;

      const existing = clusterMap.get(cluster_id);
      if (existing) {
        existing.totalPerf += perf;
        existing.count += 1;
        existing.assets.push({ asset, perf: perf });
      } else {
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
    const perfs = await this.assetClusterCachingService.getCachedPerfAll()
    const filteredPerfs = perfs.filter(item => item.asset.country_uuid && item.perf != null)
    const countryMap = new Map<string, { totalPerf: number; count: number; assets: { asset: Asset; perf: number }[] }>();

    for (const {asset, perf } of filteredPerfs) {
      const country_uuid = asset.country_uuid;

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

  private async getRankInAny( filterFn: (item: AssetPerf) => boolean, offset: number, limit:number, search: string): Promise<RankAsset[] | null> {
    const allPerfs = await this.assetClusterCachingService.getCachedPerfAll();
    let filteredPerfs = allPerfs.filter(filterFn);
    if (filteredPerfs.length === 0) return null;
    const perfByUuid = new Map(allPerfs.map(({ asset, perf }) => [asset.uuid, { asset, perf }]));

    const sectorRanks = this.assetClusterCachingService.buildRankLookup(allPerfs.map((p) => p.asset), perfByUuid, (a) => a.sector_uuid);
    const countryRanks = this.assetClusterCachingService.buildRankLookup(allPerfs.map((p) => p.asset), perfByUuid, (a) => a.country_uuid);
    const clusterRanks = this.assetClusterCachingService.buildRankLookup(allPerfs.map((p) => p.asset), perfByUuid, (a) => a.cluster?.cluster ?? null);

    filteredPerfs.sort((a, b) => b.perf - a.perf);
    if (search) {
      const term = search.toLowerCase();
      filteredPerfs = filteredPerfs.filter((item) =>{
        return item.asset.display_name?.toLowerCase().includes(term)
      });
    }
    const paginated = filteredPerfs.slice(offset, offset + limit)

    return paginated.map((item) => {
      const sector = sectorRanks.get(item.asset.uuid) ?? { rank: null, position: null };
      const country = countryRanks.get(item.asset.uuid) ?? { rank: null, position: null };
      const cluster = clusterRanks.get(item.asset.uuid) ?? { rank: null, position: null };

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

  async getUserStocksSummary(portfolio_id : string, offset: number = 0, limit: number=50, search: string="") {
    const holdings = await this.portfolioService.holdingsInPortfolio(portfolio_id)
    const targetUuids = new Set(holdings.map(a => a.assetId));
    const filterFn = (item: AssetPerf) => {
      return item.asset.asset_type != AssetType.ETF && targetUuids.has(item.asset.uuid)
    }
    return await this.getRankInAny(filterFn, offset, limit, search);
  }

  async getSectorDetails(sector_uuid : string, offset: number = 0, limit: number=50, search: string=""){
    const filterFn = (item: AssetPerf) => {
      return item.asset?.sector_uuid != null && item.asset.sector_uuid === sector_uuid
    }
    return await this.getRankInAny(filterFn, offset, limit, search)
  }

  async getCountriesDetails(country_uuid : string, offset: number = 0, limit: number=50, search: string=""){
    const filterFn = (item: AssetPerf) => {
      return item.asset?.country_uuid != null && item.asset.country_uuid === country_uuid
    }
    return await this.getRankInAny(filterFn, offset, limit, search)
  }

  async getClusterDetails(cluster_uuid : string, offset: number = 0, limit: number=50, search: string=""){
    const cluster_id = parseInt(cluster_uuid, 10);
    if (isNaN(cluster_id)) throw new Error(`NOT_A_NUMBER`);
    const filterFn = (item: AssetPerf) => {
      return item.asset?.cluster != null && item.asset.cluster.cluster === cluster_id
    }
    return await this.getRankInAny(filterFn, offset, limit, search)
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
