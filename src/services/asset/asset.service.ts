import { Asset, attributesAsset } from "../../db_schema";
import { AssetDatabaseModel, AssetPriceCompleteModel } from "../../models";
import CurrenciesService from "../currencies.service";
import MarketstackService from '../marketstack/marketstack.service';

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
      const newAsset = await Asset.create({asset})
      return newAsset;
    } 
    catch (error) {
      console.error(`Error adding ticker ${asset.ticker_name} to database:`, error);
      throw error;
    }
  }
}