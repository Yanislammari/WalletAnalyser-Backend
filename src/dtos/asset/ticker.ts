export enum AssetType {
  STOCKS = "equity",
  ETF = "etf",
}

export interface CompanyTickerDto {
  name: string;
  ticker: string;
}

export interface TickerInfoDto {
  name: string;
  ticker: string;
  item_type: AssetType;
  sector: string | null;
}
