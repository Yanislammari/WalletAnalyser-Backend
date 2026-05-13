import { attributesCountry, attributesRfrCountry, Country, RiskFreeRateCountry } from "../../db_schema";
import { BaseRepository } from "../base.repository";

export class RfrCountryRepository extends BaseRepository<RiskFreeRateCountry> {
  constructor() {
    super(RiskFreeRateCountry);
  }

  async getAllRfrCountries(): Promise<RiskFreeRateCountry[]> {
    return RiskFreeRateCountry.findAll({
      include: [
        {
          model: Country,
          as: "country_rfr", // must match the alias in association
          attributes : [attributesCountry.country_name]
        },
      ],
    });
  }

  async getRfrCoutryById(uuid : string): Promise<RiskFreeRateCountry | null> {
    const rfrCountry = await RiskFreeRateCountry.findOne({
      where: { [attributesRfrCountry.uuid]: uuid },
      include: [{
          model: Country,
          as: "country_rfr", // must match the alias in association
          attributes : [attributesCountry.country_name] 
        }],
    });
    return rfrCountry;
  }

  async getRfrCountry(countryUuid: string): Promise<RiskFreeRateCountry | null> {
    const rfrCountry = await RiskFreeRateCountry.findOne({
      where: { [attributesRfrCountry.country_uuid]: countryUuid },
      include: [{
          model: Country,
          as: "country_rfr", // must match the alias in association
          attributes : [attributesCountry.country_name] 
        }],
    });
    return rfrCountry;
  }

  async addRfrCountryToDb(countryUuid: string): Promise<RiskFreeRateCountry> {
    const existingRfrCountry = await this.getRfrCountry(countryUuid);
    if (existingRfrCountry) {
      return existingRfrCountry;
    }
    await RiskFreeRateCountry.create({
      [attributesRfrCountry.country_uuid]: countryUuid,
    });
    const getNew = await this.getRfrCountry(countryUuid)
    return getNew!;
  }
}
