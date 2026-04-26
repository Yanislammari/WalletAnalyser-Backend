import { CountryAlliasRepository } from "../../repositories";
import { attributesCountryAllias, CountryAllias } from "../../db_schema";
import { CountriesAlliasNameDto, CountryAlliasNameDto } from "../../dtos/country/country_allias";

export class CountryAlliasService {
  private readonly countryAlliasRepository: CountryAlliasRepository;

  constructor() {
    this.countryAlliasRepository = new CountryAlliasRepository();
  }

  public async getAllCountryAllias(country_uuid : string): Promise<CountriesAlliasNameDto> {
    const allias : CountryAlliasNameDto[] = await this.countryAlliasRepository.get({
      where : { [attributesCountryAllias.country_uuid] : country_uuid },
      order: [[attributesCountryAllias.country_allias_name, "ASC"]],
    }, [
      attributesCountryAllias.uuid,
      attributesCountryAllias.country_allias_name
    ]);
    return { countriesAllias: allias };
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