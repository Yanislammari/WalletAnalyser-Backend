import { Op } from "sequelize";
import { Asset, attributesAsset, attributesAssetCluster } from "../../db_schema";
import { AssetRepository, CountryRepository, SectorRepository } from "../../repositories";
import { AssetClusterRepository } from "../../repositories/asset/asset_cluster.repository";
import { AssetType } from "../../dtos";
import { AssetPriceRepository } from '../../repositories/asset/asset_price.repository';
import { PortfolioService } from "../portfolio/portfolio.service";
import { RankAsset } from "../../dtos/asset/ranking/rank";

export class AssetClusterService {
  private readonly assetClusterRepository = new AssetClusterRepository()
  private readonly assetRepository = new AssetRepository()
  private readonly assetPriceRepository = new AssetPriceRepository()
  private readonly sectorRepository = new SectorRepository()
  private readonly countryRepository = new CountryRepository()
  private readonly portfolioService = new PortfolioService()
  constructor() {}

  private perfCache: { asset: Asset; perf: number }[] | null = null;
  private perfCacheTimestamp: number = 0;
  private readonly PERF_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

  private async getPerfAll(assets: Asset[]) {
    if (assets.length === 0) return [];

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const uuids = assets.map(a => a.uuid);

    const [todayPrices, lastYearPrices] = await Promise.all([
      this.assetPriceRepository.getClosestPricesBeforeOrAtBulk(uuids, now),
      this.assetPriceRepository.getClosestPricesBeforeOrAtBulk(uuids, oneYearAgo),
    ]);

    const todayMap = new Map(todayPrices.map(p => [p.asset_uuid, p]));
    const lastYearMap = new Map(lastYearPrices.map(p => [p.asset_uuid, p]));

    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const results: { asset: Asset; perf: number }[] = [];

    for (const asset of assets) {
      const todayPrice = todayMap.get(asset.uuid);
      const lastYearPrice = lastYearMap.get(asset.uuid);

      if (todayPrice == null || lastYearPrice == null) continue;
      if (todayPrice.asset_price <= 0 || lastYearPrice.asset_price <= 0) continue;

      const todayDiff = Math.abs(now.getTime() - new Date(todayPrice.asset_price_date).getTime());
      const lastYearDiff = Math.abs(oneYearAgo.getTime() - new Date(lastYearPrice.asset_price_date).getTime());

      if (todayDiff > ONE_WEEK_MS || lastYearDiff > ONE_WEEK_MS) continue;
      
      const perf = ((todayPrice.asset_price - lastYearPrice.asset_price) / lastYearPrice.asset_price) * 100;
      results.push({ asset, perf });
    }

    return results;
  }

  private async getCachedPerfAll(): Promise<{ asset: Asset; perf: number }[]> {
    const now = Date.now();
    if (this.perfCache && (now - this.perfCacheTimestamp) < this.PERF_CACHE_TTL_MS) {
      return this.perfCache;
    }

    const allAssets = await this.assetRepository.getAllAssetsFull();
    const perfs = await this.getPerfAll(allAssets);
    perfs.sort((a, b) => b.perf - a.perf);

    this.perfCache = perfs;
    this.perfCacheTimestamp = now;
    return perfs;
  }

  async getSectorSummary(){
    const perfs = await this.getCachedPerfAll();
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
    const perfs = await this.getCachedPerfAll()
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
    const perfs = await this.getCachedPerfAll()
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

  private async getRankInAny(assets: Asset[]): Promise<RankAsset[] | null> {
    const allPerfs = await this.getCachedPerfAll();
    const targetUuids = new Set(assets.map(a => a.uuid));
    const filteredPerfs = allPerfs.filter(item => targetUuids.has(item.asset.uuid));

    if (filteredPerfs.length === 0) return null;
    const perfByUuid = new Map(allPerfs.map(({ asset, perf }) => [asset.uuid, { asset, perf }]));

    const buildRankLookup = <K>(
      universeAssets: Asset[],
      keyFn: (asset: Asset) => K | null | undefined
    ): Map<string, { rank: number; position: string }> => {
      const items = universeAssets
        .map((asset) => perfByUuid.get(asset.uuid))
        .filter((item): item is { asset: Asset; perf: number } => item != null);

      items.sort((a, b) => b.perf - a.perf);

      const groupSizes = new Map<K, number>();
      for (const item of items) {
        const key = keyFn(item.asset);
        if (key == null) continue;
        groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
      }

      const rankByUuid = new Map<string, { rank: number; position: string }>();
      const runningRank = new Map<K, number>();
      for (const item of items) {
        const key = keyFn(item.asset);
        if (key == null) continue;
        const rank = (runningRank.get(key) ?? 0) + 1;
        runningRank.set(key, rank);
        const total = groupSizes.get(key)!;
        rankByUuid.set(item.asset.uuid, { rank, position: `${rank}/${total}` });
      }
      return rankByUuid;
    };

    const sectorRanks = buildRankLookup(allPerfs.map((p) => p.asset), (a) => a.sector_uuid);
    const countryRanks = buildRankLookup(allPerfs.map((p) => p.asset), (a) => a.country_uuid);
    const clusterRanks = buildRankLookup(allPerfs.map((p) => p.asset), (a) => a.cluster?.cluster ?? null);

    filteredPerfs.sort((a, b) => b.perf - a.perf);

    return filteredPerfs.map((item) => {
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
