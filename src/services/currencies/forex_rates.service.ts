import { Op } from "sequelize";
import { attributesForexRate, Forex, ForexRate } from "../../db_schema";
import { ForexRatesRepository } from "../../repositories/currencies/forex_rates.repository";
import { ForexRepository } from "../../repositories/currencies/forex.repository";
import { ForexRateMetaData } from "../../dtos/currencies/forex_rate";
import { BaseRepository } from "../../repositories/base.repository";

export class ForexRatesService extends BaseRepository<ForexRate>{
  private readonly forexRatesRepository: ForexRatesRepository;
  private readonly forexRepository: ForexRepository;

  constructor() {
    super(ForexRate)
    this.forexRatesRepository = new ForexRatesRepository();
    this.forexRepository = new ForexRepository();
  }

  public async getAllForexRates(
    forex_uuid: string,
    offset: number,
    limit: number,
    from: Date | null,
    to: Date | null
  ): Promise<ForexRateMetaData> {
    const forex = await this.forexRepository.getForexById(forex_uuid);
    if (!forex) {
      throw new Error("NO_FOREX");
    }

    const where: any = { [attributesForexRate.forex_uuid]: forex_uuid };
    if (from || to) {
      where[attributesForexRate.forex_rate_date] = {};
      if (from) {
        where[attributesForexRate.forex_rate_date][Op.gte] = from;
      }
      if (to) {
        where[attributesForexRate.forex_rate_date][Op.lte] = to;
      }
    }

    const forexRates = await this.forexRatesRepository.get({
      where,
      offset,
      limit,
      attributes : [attributesForexRate.uuid, attributesForexRate.forex_rate, attributesForexRate.forex_rate_date],
      order: [[attributesForexRate.forex_rate_date, "DESC"]],
    });
    const length = (await this.forexRatesRepository.get({ where })).length;
    return { length, forex_rates: forexRates, forex };
  }

  public async createForexRate(forex_uuid: string, forex_rate_date: Date, forex_rate: number): Promise<ForexRate> {
    const exist = await this.forexRatesRepository.getForexRate(forex_uuid, forex_rate_date);
    if (exist) {
      throw new Error("EXIST");
    }
    return this.forexRatesRepository.addForexRateToDb(forex_uuid, forex_rate_date, forex_rate);
  }

  public async updateForexRate(
    uuid: string,
    updateData: { forex_rate_date?: Date; forex_rate?: number }
  ): Promise<ForexRate | null> {
    const forexRate = await ForexRate.findByPk(uuid);
    if (!forexRate) return null;

    if (updateData.forex_rate_date) {
      const existing = await this.forexRatesRepository.get({
        where: {
          [attributesForexRate.forex_uuid]: forexRate.forex_uuid,
          [attributesForexRate.forex_rate_date]: updateData.forex_rate_date,
        },
      });
      if (existing.length !== 0 && existing[0].uuid !== uuid) {
        throw new Error("EXIST");
      }
      forexRate.forex_rate_date = updateData.forex_rate_date;
    }
    if (updateData.forex_rate !== undefined) {
      forexRate.forex_rate = updateData.forex_rate;
    }

    await forexRate.save();
    return forexRate;
  }

  public async deleteForexRate(uuid: string): Promise<boolean> {
    const forexRate = await ForexRate.findByPk(uuid);
    if (!forexRate) return false;
    await forexRate.destroy();
    return true;
  }
}
