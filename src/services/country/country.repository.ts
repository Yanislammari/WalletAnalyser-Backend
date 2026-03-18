import { attributesCountry, attributesCountryAllias, Country, CountryAllias } from "../../db_schema";

export default class CountryRepository {
  constructor() {

  }

  async getCountryByName(countryName: string): Promise<Country | null> {
    try {
      const country = await Country.findOne({
        where: {
          [attributesCountry.country_name]: countryName
        },
      });

      if (country) return country;
      const alias = await CountryAllias.findOne({
        where: {
          [attributesCountryAllias.country_allias_name]: countryName
        },
        include: [
          {
            model: Country,
            required: true
          }
        ]
      });
      return alias ? alias.country : null;
    } catch (error) {
      console.error(`Error fetching ${countryName}`, error);
      return null;
    }
  }

  async addCountryToDatabase(country : string) : Promise<Country> {
    try {
      const existingCountry = await this.getCountryByName(country);
      if (existingCountry) {
        return existingCountry;
      }
      const newCountry = await Country.create({ // MUST BE THE FRENCH NAME !!!!!!!! the english name etc should be in alliases
        [attributesCountry.country_name]: country
      });
      return newCountry;
    } 
    catch (error) {
      console.error(`Error adding country ${country} to database:`, error);4
      throw error;
    }
  }
}