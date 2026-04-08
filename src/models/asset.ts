import { AssetType } from "../dtos";

export class AssetInfoModel {
  name: string;
  ticker: string;
  asset_type : AssetType;
  sector_uuid: string;
  country_uuid: string;

  constructor(name: string, ticker: string, sector_uuid: string, country_uuid: string,asset_type : AssetType) {
    this.name = name;
    this.ticker = ticker;
    this.sector_uuid = sector_uuid;
    this.country_uuid = country_uuid;
    this.asset_type = asset_type;
  }
}

export class AssetDatabaseModel {
  official_name: string | null;
  ticker_name: string | null;
  asset_type: AssetType | null;
  sector_uuid: string | null;
  country_uuid: string | null;
  base_currency_uuid: string | null;

  constructor(
    official_name: string | null,
    ticker_name: string | null,
    asset_type: AssetType | null,
    sector_uuid: string | null,
    country_uuid: string | null,
    base_currency_uuid: string | null
  ) {
    this.official_name = official_name;
    this.ticker_name = ticker_name;
    this.asset_type = asset_type;
    this.sector_uuid = sector_uuid;
    this.country_uuid = country_uuid;
    this.base_currency_uuid = base_currency_uuid;
  }
}

export class AssetPriceCompletModel {
  date: Date;
  adj_close: number;
  price_currency: string;
  asset_type: string;

  constructor(date: Date, price: number, currency: string, asset_type: string) {
    this.date = date;
    this.adj_close = price;
    this.price_currency = currency;
    this.asset_type = asset_type;
  }
}

export class AssetPriceModel {
  date: Date;
  adj_close: number;

  constructor(date: Date, price: number) {
    this.date = date;
    this.adj_close = price;
  }
}
