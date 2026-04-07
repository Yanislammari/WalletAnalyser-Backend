import { SectorConcentration, attributesSectorConcentration } from "../../db_schema";

export default class SectorConcentrationRepository {

  constructor() {

  }

  async getSectorConcentrationOfAsset(assetUuid : string, sectorUuid : string) : Promise <SectorConcentration | null> {
    try {
      const existingSectorConcentration = await SectorConcentration.findOne({
        where: {
          [attributesSectorConcentration.asset_uuid]: assetUuid,
          [attributesSectorConcentration.sector_uuid]: sectorUuid
        },
      }) || null;
      return existingSectorConcentration;
    } catch (error) {
      console.error(`Error fetching sector concentration of ${assetUuid} on ${sectorUuid}`, error);
      return null;
    }
  } 

  async addSectorConcentrationToDatabase(assetUuid : string, sectorUuid : string, concentration : number) : Promise<SectorConcentration> {
    try {
      const existingSectorConcentration = await this.getSectorConcentrationOfAsset(assetUuid, sectorUuid);
      if (existingSectorConcentration) {
        return existingSectorConcentration;
      }
      const newSectorConcentration = await SectorConcentration.create({
        [attributesSectorConcentration.sector_uuid] : sectorUuid,
        [attributesSectorConcentration.asset_uuid]: assetUuid,
        [attributesSectorConcentration.sector_concentration_percentage] : concentration
      });
      return newSectorConcentration;
    } 
    catch (error) {
      console.error(`Error adding sector concentration ${assetUuid} on ${sectorUuid}`, error);
      throw error;
    }
  }
}