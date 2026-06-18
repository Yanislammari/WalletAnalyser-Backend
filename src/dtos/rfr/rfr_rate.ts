import { RiskFreeRate, RiskFreeRateCountry } from "../../db_schema"

export interface RiskFreeRateShort {
  uuid : string
  rfr_date : Date
  rfr_percent_rate : number
}

export interface RfrRateMetaData {
  length : number
  rfr_rates : RiskFreeRateShort[]
  rfr_country : RiskFreeRateCountry
}