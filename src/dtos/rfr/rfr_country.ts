import { RiskFreeRateCountry } from "../../db_schema"

export interface RfrCountryMetaData {
  rfr_country : RiskFreeRateCountry
  last_update : Date | null
}


export interface RfrCountriesMetaData {
  rfr_countries : RfrCountryMetaData[]
}

export interface RfrCountryPost {
  rfr_country : RiskFreeRateCountry
  last_update : Date | null
  length : number
}