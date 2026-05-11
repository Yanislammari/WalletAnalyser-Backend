import { Asset, EtfHoldingsAsset } from "../../db_schema";

export interface ETFHolding {
  investment_security: ETFconcentration;
}

export interface MatchingNames {
  name_json : string,
  name_db : string
}

interface ETFconcentration {
  name: string;
  percent_value: number;
  invested_country: string;
}

export interface SectorConcentrationEtf {
  sector_uuid : string
  sector_name : string
  percentage_in_sector : number
}

export interface CountryConcentrationEtf {
  country_uuid : string
  country_name : string
  percentage_in_country : number
}


export interface EtfconcentrationMetaData {
  etf : Asset
  etf_asset : EtfHoldingsAsset[]
  length : number
  sector_concentrations : SectorConcentrationEtf[]
  country_concentrations : CountryConcentrationEtf[]
}

export interface EtfUpdateHolding {
  etf_holding : EtfHoldingsAsset
  sector_concentrations : SectorConcentrationEtf[]
  country_concentrations : CountryConcentrationEtf[]
}

export interface EtfAssetMetaData {
  etf_asset : EtfHoldingsAsset[]
  length : number
}

export interface EtfPatchAssetPayload {
  asset_percentage_concentration_in_etf : number
  sector_uuid : string
  country_uuid : string
  asset_uuid : string
}

export interface EtfPostHolding {
  asset_percentage_concentration_in_etf : number
  asset_uuid : string
}