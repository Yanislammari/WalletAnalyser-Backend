import { CountryConcentration, attributesCountryConcentration } from "../../db_schema";

export class CountryConcentrationRepository {
  constructor() {}

  async getCountryConcentrationOfAsset(assetUuid: string, countryUuid: string): Promise<CountryConcentration | null> {
    try {
      const existingCountryConcentration =
        (await CountryConcentration.findOne({
          where: {
            [attributesCountryConcentration.asset_uuid]: assetUuid,
            [attributesCountryConcentration.country_uuid]: countryUuid,
          },
        })) || null;
      return existingCountryConcentration;
    } catch (error) {
      console.error(`Error fetching country concentration ${assetUuid} on ${countryUuid}`, error);
      return null;
    }
  }

  async addCountryConcentrationToDatabase(assetUuid: string, countryUuid: string, concentration: number): Promise<CountryConcentration> {
    try {
      const existingCountryConcentration = await this.getCountryConcentrationOfAsset(assetUuid, countryUuid);
      if (existingCountryConcentration) {
        return existingCountryConcentration;
      }
      const newCountryConcentration = await CountryConcentration.create({
        [attributesCountryConcentration.country_uuid]: countryUuid,
        [attributesCountryConcentration.asset_uuid]: assetUuid,
        [attributesCountryConcentration.country_concentration_percentage]: concentration,
      });
      return newCountryConcentration;
    } catch (error) {
      console.error(`Error adding country concentration ${assetUuid} on ${countryUuid}`, error);
      throw error;
    }
  }
}
