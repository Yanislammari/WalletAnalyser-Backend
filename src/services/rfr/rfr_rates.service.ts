import { RfrRepository } from "../../repositories/rfr/rfr.repository";
import { attributesRfr, RiskFreeRate } from "../../db_schema";
import { RfrRateMetaData } from "../../dtos/rfr/rfr_rate";
import { RfrCountryRepository } from "../../repositories";
import { Op } from "sequelize";

export class RfrRatesService {
  private readonly rfrRepository: RfrRepository;
  private readonly rfrCountryRepository : RfrCountryRepository

  constructor() {
    this.rfrRepository = new RfrRepository();
    this.rfrCountryRepository = new RfrCountryRepository();
  }

  public async getAllRfrRates(rfr_country_uuid: string, offset : number, limit : number, from : Date | null, to : Date | null): Promise<RfrRateMetaData> {
    const rfr_country = await this.rfrCountryRepository.getRfrCoutryById(rfr_country_uuid)
    if(!rfr_country){
      throw new Error("NO_RFR_COUNTRY")
    }
    const where: any = {[attributesRfr.rfr_country_uuid]: rfr_country_uuid}
    if (from || to) {
      where[attributesRfr.rfr_date] = {}
      if (from) {
        where[attributesRfr.rfr_date][Op.gte] = from
      }

      if (to) {
        where[attributesRfr.rfr_date][Op.lte] = to
      }
    }
    const rfr_rates = await this.rfrRepository.get({
        where,
        offset : offset,
        limit : limit,
        order: [[attributesRfr.rfr_date, "DESC"]],
    })
    const length = (await this.rfrRepository.get({where})).length
    return { length, rfr_rates, rfr_country};
  }

  public async createRfrRate(rfr_country_uuid: string, rfr_date: Date, rfr_percent_rate: number): Promise<RiskFreeRate> {
    const exist = await this.rfrRepository.get({ where : { [attributesRfr.rfr_date] : rfr_date }})
    if(exist.length != 0){
      throw Error("EXIST")
    }
    return await this.rfrRepository.addRfrToDb(rfr_country_uuid, rfr_date, rfr_percent_rate);
  }

  public async updateRfrRate(uuid: string, updateData: { rfr_date?: Date; rfr_percent_rate?: number }): Promise<RiskFreeRate | null> {
    const rfrRate = await RiskFreeRate.findByPk(uuid);
    if (!rfrRate) return null;

    const exist = await this.rfrRepository.get({ where : { [attributesRfr.rfr_date] : updateData.rfr_date }})
    if(exist.length != 0){
      throw Error("EXIST")
    }

    if (updateData.rfr_date) {
      rfrRate.rfr_date = updateData.rfr_date;
    }
    if (updateData.rfr_percent_rate !== undefined) {
      rfrRate.rfr_percent_rate = updateData.rfr_percent_rate;
    }

    await rfrRate.save();
    return rfrRate;
  }

  public async deleteRfrRate(uuid: string): Promise<boolean> {
    const rfrRate = await RiskFreeRate.findByPk(uuid);
    if (!rfrRate) return false;

    await rfrRate.destroy();
    return true;
  }
}