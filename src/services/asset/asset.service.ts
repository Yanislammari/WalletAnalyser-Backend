import { Asset, attributesAsset } from "../../db_schema";
import { AssetDatabaseModel } from "../../models";

export default class AssetService {

  constructor() {

  }

  async getAssetFromTicker(ticker : string) : Promise <Asset | null> {
    try {
      const existingAsset = await Asset.findOne({
        where: {
          [attributesAsset.ticker_name]: ticker
        }
      }) || null;
      return existingAsset;
    } catch (error) {
      console.error(`Error fetching asset with ticker ${ticker} from the database:`, error);
      return null;
    }
  } 

  async addAssetFromAssetToDatabase(asset : AssetDatabaseModel) : Promise<Asset> {
    try {
      const existingAsset = await this.getAssetFromTicker(asset.ticker_name);
      if (existingAsset) {
        return existingAsset;
      }
      const newAsset = await Asset.create({
         [attributesAsset.base_currency_uuid] : asset.base_currency_uuid,
         [attributesAsset.asset_type] : asset.asset_type,
         [attributesAsset.exchange_code] : asset.exchange_code,
         [attributesAsset.official_name] : asset.official_name,
         [attributesAsset.ticker_name] : asset.ticker_name,
      });
      return newAsset;
    } 
    catch (error) {
      console.error(`Error adding ticker ${asset.ticker_name} to database:`, error);
      throw error;
    }
  }
}