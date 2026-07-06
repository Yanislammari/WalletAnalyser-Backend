import { Asset } from "../../../db_schema";

export interface RankAsset {
  asset : Asset,
  perf : number
  rank_sector : number | null
  rank_sector_position : string | null
  rank_country : number | null
  rank_country_position : string | null
  rank_cluster : number | null 
  rank_cluster_position : string | null
}