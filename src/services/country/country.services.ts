import { CountryRepository } from "../../repositories";
import { attributesCountry, Country } from "../../db_schema";
import { CountryNameDto, CountriesNameDto } from "../../dtos/country/country";

export class CountryService {
  private readonly countryRepository: CountryRepository;

  constructor() {
    this.countryRepository = new CountryRepository();
  }

  public async getCountry(uuid : string): Promise<CountryNameDto> {
    const country: CountryNameDto | null = await this.countryRepository.getById(uuid)
    if(!country){
      throw new Error("NO_COUNTRY")
    }
    return country
  }

  public async getCountries(): Promise<CountriesNameDto> {
    const countries: CountryNameDto[] = await this.countryRepository.get({
      order: [[attributesCountry.country_name, "ASC"]],
    }, [
      attributesCountry.uuid,
      attributesCountry.country_name
    ])
    return { countries: countries } as CountriesNameDto
  }

  public async addCountries(country_name : string): Promise<Country>{
    const country = await this.countryRepository.add({country_name})
    return country
  }

  public async updateCountry(uuid: string, country_name: string): Promise<CountryNameDto | null>{
    const country = await this.countryRepository.update(uuid, {country_name})
    return country
  }

  public async deleteCountry(uuid: string): Promise<boolean>{
    return await this.countryRepository.remove(uuid)
  }
}