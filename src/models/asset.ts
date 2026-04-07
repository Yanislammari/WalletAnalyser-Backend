export class AssetInfoModel {
  name: string;
  ticker: string;
  sector: string;
  exchange_code: string;

  constructor(name: string, ticker: string, sector: string, exchange_code: string) {
    this.name = name;
    this.ticker = ticker;
    this.sector = sector;
    this.exchange_code = exchange_code;
  }
}

export class AssetDatabaseModel {
  base_currency_uuid: string | null;
  official_name: string;
  ticker_name: string;
  exchange_code: string;
  asset_type: string;

  constructor(base_currency_uuid: string | null, official_name: string, ticker_name: string, exchange_code: string, type: string) {
    this.base_currency_uuid = base_currency_uuid;
    this.official_name = official_name;
    this.ticker_name = ticker_name;
    this.exchange_code = exchange_code;
    this.asset_type = type;
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
