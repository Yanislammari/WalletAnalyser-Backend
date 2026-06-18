import { Asset } from "../../db_schema"

export interface AssetPriceShortened {
  uuid : string
  asset_price : number
  asset_price_date : Date
}

export interface MetaDataAssetPrice {
  length : number
  asset : Asset
  asset_prices : AssetPriceShortened[]
}