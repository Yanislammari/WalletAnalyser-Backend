import { Asset } from "../db_schema";

export interface RankingRanks {
  sectorRanks: Map<string, { rank: number; position: string }>;
  countryRanks: Map<string, { rank: number; position: string }>;
  clusterRanks: Map<string, { rank: number; position: string }>;
}

export interface AssetPerf {
  asset: Asset,
  perf: number
}