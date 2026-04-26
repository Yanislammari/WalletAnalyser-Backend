import { CountryRepository } from "../repositories";
import { attributesCountry } from "../db_schema";
import { CountryNameDto, CountriesNameDto } from "../dtos/country/country";

export class CountryService {
  private readonly countryRepository: CountryRepository;

  constructor() {
    this.countryRepository = new CountryRepository();
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

  public async addCountries(country_name : string): Promise<CountryNameDto>{
    const country : CountryNameDto = await this.countryRepository.add({country_name})
    return country
  }
}