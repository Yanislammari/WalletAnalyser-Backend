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

export interface AssetShort {
  uuid: string;
  base_currency_uuid: string;
  ticker_name: string;
  official_name: string;
  sector_uuid: string;
  country_uuid: string;
}

export interface MetaDataAssetShort {
  last_update : Date | undefined
  asset : AssetShort
}

export interface MetaDataAssets {
  assets : MetaDataAssetShort[]
  length : number
}
