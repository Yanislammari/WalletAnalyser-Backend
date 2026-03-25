import { AssetPrice, attributesAssetPrice } from "../../db_schema";
import { AssetPriceModel,AssetPriceCompletModel } from "../../models";

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

  async getLatestAssetPrice(assetUuid : string) : Promise<AssetPrice | null> {
    try {
      const latestPrice = await AssetPrice.findOne({
        where: {
          [attributesAssetPrice.asset_uuid]: assetUuid
        },
        order: [
          [attributesAssetPrice.asset_price_date, 'DESC']  // newest first
        ]
      });
      return latestPrice;
    }
    catch (error) {
      console.error("Error fetching the latest asset price from the database:", error);
      throw error;
    }
  }

  async addAssetPrice(assetUuid : string, date : Date, price : number) : Promise<AssetPrice>{
    try{
      const exisitingAssetPrice = await this.getAssetPriceAtDate(assetUuid,date)
      if(exisitingAssetPrice){
        return exisitingAssetPrice
      }
      const addedAssetPrice = AssetPrice.create({
        [attributesAssetPrice.asset_uuid] : assetUuid,
        [attributesAssetPrice.asset_price_date] : date,
        [attributesAssetPrice.asset_price] : price
      });
      return addedAssetPrice;
    }
    catch(error) {
      console.error(`Error adding price of asset : ${assetUuid} to database:`, error);
      throw error;
    }
  }
}