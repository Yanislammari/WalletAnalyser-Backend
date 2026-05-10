import { EtfHoldingsAsset } from "../../db_schema";

export interface ETFHolding {
  investment_security: ETFconcentration;
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


export interface EtfMetaData {
  etf_asset : EtfHoldingsAsset[]
  sector_concentrations : SectorConcentrationEtf[]
  country_concentrations : CountryConcentrationEtf[]
}
