import { RfrCountryRepository } from "../../repositories/rfr/rfr_country.repository";
import { attributesRfrCountry, RiskFreeRateCountry } from "../../db_schema";
import { RfrRepository } from "../../repositories";
import { RfrCountryMetaData, RfrCountryPost } from "../../dtos/rfr/rfr_country";

export class RfrCountryService {
  private readonly rfrCountryRepository: RfrCountryRepository;
  private readonly rfrRepository : RfrRepository

  constructor() {
    this.rfrCountryRepository = new RfrCountryRepository();
    this.rfrRepository = new RfrRepository();
  }

  public async getAllRfrCountries(): Promise<RfrCountryMetaData[]> {
    const riskFreeRateCountries = await this.rfrCountryRepository.getAllRfrCountries()
    const enriched: RfrCountryMetaData[] = await Promise.all(
      riskFreeRateCountries.map(async (rfrCountry) => ({
        rfr_country: rfrCountry,
        last_update: (await this.rfrRepository.getLatestRfr(rfrCountry.uuid))?.rfr_date ?? null
      }))
    );
    return enriched
  }

  public async createRfrCountry(country_uuid: string, dates : Date[], percent_rates : string[]) : Promise<RfrCountryPost> {
    const riskFreeRateCountry = await this.rfrCountryRepository.addRfrCountryToDb(country_uuid);
    const seenMonths = new Set();
    const latestRate = await this.rfrRepository.getLatestRfr(riskFreeRateCountry.uuid);
    let latestDate = new Date(0);
    if (latestRate) {
      latestDate = latestRate.rfr_date;
      const monthKey = `${latestDate.getFullYear()}-${latestDate.getMonth()}`;
      seenMonths.add(monthKey);
    }
    let addToDb = 0;
    let latestInsertedDate: Date | null = null;
    for (let i = dates.length - 1; i > 0; i--) {
      if (dates[i] <= latestDate) {
        //console.log("Stop running at index", i-dates.length+1, "for country", countryUuid.country_name);
        break;
      }
      const parsedValue = parseFloat(percent_rates[i]);
      const d = new Date(dates[i]);
      if (Number.isNaN(parsedValue)) continue;
      if (isNaN(d.getTime())) continue;

      const monthKey = `${d.getFullYear()}-${d.getMonth()}`; // unique per month
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        if (!latestInsertedDate) {
          latestInsertedDate = d;
        }
        addToDb ++;
        await this.rfrRepository.addRfrToDb(riskFreeRateCountry.uuid, dates[i], parsedValue);
      }
    }
    return { rfr_country : riskFreeRateCountry, last_update : latestInsertedDate, length : addToDb }
  }

  public async updateRfrCountry(uuid: string, country_uuid: string): Promise<RiskFreeRateCountry | null> {
    const rfrCountry = await this.rfrCountryRepository.update(uuid, {
      [attributesRfrCountry.country_uuid]: country_uuid
    });
    if (!rfrCountry) return null;
    return rfrCountry;
  }

  public async deleteRfrCountry(uuid: string): Promise<boolean> {
    return await this.rfrCountryRepository.remove(uuid);
  }
}