import { Forex, ForexRate } from "../../db_schema";

export interface ForexRateShort {
  uuid: string;
  forex_rate_date: Date;
  forex_rate: number;
}

export interface ForexRateMetaData {
  length: number;
  forex_rates: ForexRate[];
  forex: Forex;
}
