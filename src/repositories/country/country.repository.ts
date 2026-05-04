import { Op } from "sequelize";
import { attributesCountry, attributesCountryAllias, Country, CountryAllias } from "../../db_schema";

export class CountryRepository {
  constructor() {}

  async getCountryByName(countryName: string): Promise<Country | null> {
    try {
      const country = await Country.findOne({
        where: {
          [attributesCountry.country_name]: {
            [Op.iLike]: countryName, // PostgreSQL case-insensitive LIKE
          },
        },
      });

      if (country) return country;
      const alias = await CountryAllias.findOne({
        where: {
          [attributesCountryAllias.country_allias_name]: {
            [Op.iLike]: countryName,
          },
        },
        include: [
          {
            model: Country,
            as: "country",
            required: true,
          },
        ],
      });
      return alias ? alias.country : null;
    } catch (error) {
      console.error(`Error fetching ${countryName}`, error);
      return null;
    }
  }

  async getAllCountries(): Promise<Country[]> {
    try {
      const countries = await Country.findAll();
      return countries;
    } catch (error) {
      console.error(`Error fetching all countries`, error);
      return [];
    }
  }

  async addCountryToDatabase(country: string): Promise<Country> {
    try {
      const existingCountry = await this.getCountryByName(country);
      if (existingCountry) {
        return existingCountry;
      }
      const newCountry = await Country.create({
        [attributesCountry.country_name]: country,
      });
      return newCountry;
    } catch (error) {
      console.error(`Error adding country ${country} to database:`, error);
      throw error;
    }
  }
}
