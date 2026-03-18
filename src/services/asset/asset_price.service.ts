import { AssetPrice, attributesAssetPrice } from "../../db_schema";
import { AssetPriceCompleteModel, AssetPriceModel } from "../../models";

export default class AssetPriceService {
  constructor() {

  }

  async getAssetPriceAtDate(assetUuid : string, dateOfPrice : Date) : Promise<AssetPrice | null >{
    try{
      const existingAssetPrice = AssetPrice.findOne({
        where : {
          [attributesAssetPrice.asset_price_date] : dateOfPrice,
          [attributesAssetPrice.asset_uuid] : assetUuid
        }
      }) || null;
      return existingAssetPrice;
    } catch (error){
      console.error("Error fetching the price on a spe date:", error);
      throw error;
    }
  }

  async getLatestAssetPrice(assetUuid : string) : Promise<Date> {
    try {
      const latestPrice = await AssetPrice.findOne({
        where: {
          [attributesAssetPrice.asset_uuid]: assetUuid
        },
        order: [
          [attributesAssetPrice.asset_price_date, 'DESC']  // newest first
        ]
      });
      return latestPrice ? latestPrice.asset_price_date : new Date(0);
    }
    catch (error) {
      console.error("Error fetching the latest asset price from the database:", error);
      throw error;
    }
  }

  async addAssetPrice(assetUuid : string, assetPrice : (AssetPriceCompleteModel | AssetPriceModel)) : Promise<AssetPrice>{
    try{
      const exisitingAssetPrice = await this.getAssetPriceAtDate(assetUuid,assetPrice.date)
      if(exisitingAssetPrice){
        return exisitingAssetPrice
      }
      const addedAssetPrice = AssetPrice.create({
        [attributesAssetPrice.asset_uuid] : assetUuid,
        [attributesAssetPrice.asset_price_date] : assetPrice.date,
        [attributesAssetPrice.asset_price] : assetPrice.adj_close
      });
      return addedAssetPrice;
    }
    catch(error) {
      console.error(`Error adding price of asset : ${assetUuid} to database:`, error);
      throw error;
    }
  }
}