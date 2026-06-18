import { attributesRfr, RiskFreeRate } from "../../db_schema";
import { BaseRepository } from "../base.repository";

export class RfrRepository extends BaseRepository<RiskFreeRate>{
  constructor() {
    super(RiskFreeRate)
  }

  async getLatestRfr(rfrCountryUuid: string): Promise<RiskFreeRate | null> {
    const latestPrice = await RiskFreeRate.findOne({
      where: {
        [attributesRfr.rfr_country_uuid]: rfrCountryUuid,
      },
      order: [[attributesRfr.rfr_date, "DESC"]],
    });
    return latestPrice;
  }

  async getRfr(rfrCountryUuid: string, date: Date): Promise<RiskFreeRate | null> {
    const rfr = await RiskFreeRate.findOne({
      where: {
        [attributesRfr.rfr_country_uuid]: rfrCountryUuid,
        [attributesRfr.rfr_date]: date,
      },
    });
    return rfr;
  }

  async addRfrToDb(rfrCountryUuid: string, date: Date, rate: number): Promise<RiskFreeRate> {
    try {
      const existingRfr = await this.getRfr(rfrCountryUuid, date);
      if (existingRfr) {
        return existingRfr;
      }
      const rfr = await RiskFreeRate.create({
        [attributesRfr.rfr_country_uuid]: rfrCountryUuid,
        [attributesRfr.rfr_date]: date,
        [attributesRfr.rfr_percent_rate]: rate,
      });
      return rfr;
    } catch (e) {
      console.error("An error occured while adding a rfr to db ", e);
      throw e;
    }
  }
}
