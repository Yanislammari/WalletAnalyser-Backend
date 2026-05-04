import { Forex } from "../../db_schema";

export interface ForexMetaData {
  forex: Forex;
  last_update: Date | null;
}

export interface ForexListMetaData {
  forex_list: ForexMetaData[];
}

export interface ForexPost {
  forex: Forex;
  last_update: Date | null;
  length: number;
}