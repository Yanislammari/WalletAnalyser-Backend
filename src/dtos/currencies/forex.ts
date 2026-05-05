import { Forex } from "../../db_schema";

export interface ForexMetaData {
  forex: Forex;
  last_update: Date | null;
}

export interface ForexListMetaData {
  forex_list: ForexMetaData[];
}

export interface ForexListMessage {
  forex_list: ForexMetaData[];
  message : string
}