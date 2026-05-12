import { attributesForexRate, ForexRate } from "../../db_schema";
import { BaseRepository } from "../base.repository";

export class ForexRatesRepository extends BaseRepository<ForexRate> {
  constructor() {
    super(ForexRate);
  }

  async getLatestForexRate(forexUuid: string): Promise<ForexRate | null> {
    return ForexRate.findOne({
      where: {
        [attributesForexRate.forex_uuid]: forexUuid,
      },
      order: [[attributesForexRate.forex_rate_date, "DESC"]],
    });
  }

  async getForexRate(forexUuid: string, date: Date): Promise<ForexRate | null> {
    return ForexRate.findOne({
      where: {
        [attributesForexRate.forex_uuid]: forexUuid,
        [attributesForexRate.forex_rate_date]: date,
      },
    });
  }

  async addForexRateToDb(forexUuid: string, date: Date, rate: number): Promise<ForexRate> {
    const existingRate = await this.getForexRate(forexUuid, date);
    if (existingRate) {
      return existingRate;
    }

    return ForexRate.create({
      [attributesForexRate.forex_uuid]: forexUuid,
      [attributesForexRate.forex_rate_date]: date,
      [attributesForexRate.forex_rate]: rate,
    });
  }
}
