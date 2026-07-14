import { Asset } from "../../../db_schema";
import { AssetRepository } from "../../../repositories";
import { AssetPriceRepository } from "../../../repositories/asset/asset_price.repository";
import { AssetPerf, RankingRanks } from "../../../models/ranking";

export class AssetClusterCachingService {
  private static instance: AssetClusterCachingService;
  private readonly assetRepository = new AssetRepository();
  private readonly assetPriceRepository = new AssetPriceRepository();

  private constructor() {}

  static getInstance(): AssetClusterCachingService {
    if (!AssetClusterCachingService.instance) {
      AssetClusterCachingService.instance = new AssetClusterCachingService();
    }
    return AssetClusterCachingService.instance;
  }

  private perfCache: AssetPerf[] | null = null;
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

    const ONE_WEEK_MS = 14 * 24 * 60 * 60 * 1000;
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

  buildRankLookup<K>(universeAssets: Asset[], perfByUuid: Map<string, { asset: Asset; perf: number }>, keyFn: (asset: Asset) => K | null | undefined
  ): Map<string, { rank: number; position: string }> {
    const items = universeAssets
      .map((asset) => perfByUuid.get(asset.uuid))
      .filter((item) => item != null);

    items.sort((a, b) => b.perf - a.perf);

    const groupSizes = new Map<K, number>();
    for (const item of items) {
      const key = keyFn(item.asset);  // unique key
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
  }

  async getCachedPerfAll(): Promise<AssetPerf[]> {
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
}