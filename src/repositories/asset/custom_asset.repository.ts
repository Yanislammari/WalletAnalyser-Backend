import { CustomAsset } from "../../db_schema/asset/custom_asset";

export class CustomAssetRepository {
  public async getAll(): Promise<CustomAsset[]> {
    return CustomAsset.findAll();
  }

  public async getByUUID(uuid: string): Promise<CustomAsset | null> {
    return CustomAsset.findOne({ where: { uuid } });
  }

  public async getByTicker(ticker: string): Promise<CustomAsset | null> {
    return CustomAsset.findOne({ where: { ticker_name: ticker.toUpperCase() } });
  }

  public async add(data: {
    ticker_name: string;
    official_name: string | null;
    base_currency_uuid: string | null;
    asset_type: string | null;
  }): Promise<CustomAsset> {
    return CustomAsset.create(data as any);
  }
}
