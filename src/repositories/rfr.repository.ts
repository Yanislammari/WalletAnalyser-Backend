import { attributesRfr, RiskFreeRate } from "../db_schema";

export class RfrRepository {

  constructor() {

  }

  async getLatestRfr(countryUuid : string): Promise<RiskFreeRate | null> {
    try {
      const latestPrice = await RiskFreeRate.findOne({
        where: {
          [attributesRfr.country_uuid]: countryUuid
        },
        order: [
          [attributesRfr.rfr_date, 'DESC'] 
        ]
      });
      return latestPrice;
    }
    catch (error) {
      console.error("Error fetching the latest rfr from the database:", error);
      throw error;
    }
  }

  async getRfr(countryUuid : string, date : Date): Promise<RiskFreeRate | null>{
    try{
      const rfr = await RiskFreeRate.findOne({
        where : {
          [attributesRfr.country_uuid] : countryUuid,
          [attributesRfr.rfr_date] : date,
        }
      })
      return rfr
    }catch(e){
      console.error("An error occured while getting a rfr from db ",e)
      throw e
    }
  }

  async addRfrToDb(countryUuid : string, date : Date, rate : number): Promise<RiskFreeRate>{
      try{
        const existingRfr = await this.getRfr(countryUuid,date)
        if(existingRfr){
          return existingRfr
        }
        const rfr = await RiskFreeRate.create({
          [attributesRfr.country_uuid] : countryUuid,
          [attributesRfr.rfr_date] : date,
          [attributesRfr.rfr_percent_rate] : rate,
        })
        return rfr
      }catch(e){
        console.error("An error occured while adding a rfr to db ",e)
        throw e
      }
  }
}
