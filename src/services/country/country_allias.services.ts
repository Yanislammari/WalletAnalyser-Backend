import { CountryAlliasRepository, CountryRepository } from "../../repositories";
import { attributesCountryAllias, CountryAllias } from "../../db_schema";
import { CountriesAlliasNameDto, CountryAlliasNameDto } from "../../dtos/country/country_allias";
import { th } from "zod/locales";

export class CountryAlliasService {
  private readonly countryAlliasRepository: CountryAlliasRepository;
  private readonly countryRepository : CountryRepository;

  constructor() {
    this.countryAlliasRepository = new CountryAlliasRepository();
    this.countryRepository = new CountryRepository();
  }

  public async getAllCountryAllias(country_uuid : string): Promise<CountriesAlliasNameDto> {
    const country = await this.countryRepository.getById(country_uuid);
    if (!country) {
      throw new Error("Country not found");
    }
    const allias : CountryAlliasNameDto[] = await this.countryAlliasRepository.get({
      where : { [attributesCountryAllias.country_uuid] : country_uuid },
      order: [[attributesCountryAllias.country_allias_name, "ASC"]],
    }, [
      attributesCountryAllias.uuid,
      attributesCountryAllias.country_allias_name
    ]);
    return { country : country, countries_allias: allias };
  }

  public async createCountryAllias(country_uuid: string, country_allias_name: string):  Promise<CountryAllias> {
    return this.countryAlliasRepository.addCountryAlliasToDatabase(country_uuid, country_allias_name);
  }

  public async updateCountryAllias(uuid: string, country_allias_name: string): Promise<CountryAllias | null> {
    const countryAllias = await this.countryAlliasRepository.update(uuid, {
      [attributesCountryAllias.country_allias_name]: country_allias_name
    });
    if (!countryAllias) return null;
    return countryAllias;
  }

  public async deleteCountryAllias(uuid: string): Promise<boolean> {
    return await this.countryAlliasRepository.remove(uuid);
  }
}