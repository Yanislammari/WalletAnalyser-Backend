import { LevelBadge } from "../db_schema";

export interface UserStats {
  hasAccount : boolean
  numberOfAssetSell : number
  numberOfAssetBuy : number
  numberOfETFSell : number
  numberOfETFBuy : number
  portfolioValue : number
  amountOfDividend : number
}

export interface BadgeRule {
  badge_uuid: string;
  check: (stats: UserStats) => LevelBadge | null;
};

export interface BadgeCreation {
  badge_image_path : string,
  badge_title : string,
  badge_label : string
  check: (stats: UserStats) => LevelBadge | null;
}

export const BADGE_RULES : BadgeRule[] = []