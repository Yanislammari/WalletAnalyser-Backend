import { Op } from "sequelize";
import { Country, CountryAllias, attributesCountryAllias } from "../../db_schema";

export class CountryAlliasRepository {
  constructor() {}

  async getCountryAlliasByName(countryAlliasName: string): Promise<CountryAllias | null> {
    try {
      const existingCountryAllias =
        (await CountryAllias.findOne({
          where: {
            [attributesCountryAllias.country_allias_name]: {
              [Op.iLike]: countryAlliasName,
            },
          },
          include: [
            {
              model: Country,
              as: "country", // must match the alias in association
            },
          ],
        })) || null;
      return existingCountryAllias;
    } catch (error) {
      console.error(`Error fetching ${countryAlliasName}`, error);
      return null;
    }
  }

  async addCountryAlliasToDatabase(officialCountryUuid: string, countryAlliasName: string): Promise<CountryAllias> {
    try {
      const existingCountryAllias = await this.getCountryAlliasByName(countryAlliasName);
      if (existingCountryAllias) {
        return existingCountryAllias;
      }
      const newCountryAllias = await CountryAllias.create({
        [attributesCountryAllias.country_uuid]: officialCountryUuid,
        [attributesCountryAllias.country_allias_name]: countryAlliasName,
      });
      return newCountryAllias;
    } catch (error) {
      console.error(`Error adding country allias ${countryAlliasName} to database:`, error);
      throw error;
    }
  }
}
