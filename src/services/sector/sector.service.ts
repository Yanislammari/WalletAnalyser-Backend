import { Sector, attributesSector } from "../../db_schema";

export default class SectorService {

  constructor() {

  }

  async getSector(sector : string) : Promise <Sector | null> {
    try {
      const existingSector = await Sector.findOne({
        where: {
          [attributesSector.sector_name]: sector
        }
      }) || null;
      return existingSector;
    } catch (error) {
      console.error(`Error fetching ${sector}`, error);
      return null;
    }
  } 

  async addSectorToDatabase(sector : string) : Promise<Sector> {
    try {
      const existingSector = await this.getSector(sector);
      if (existingSector) {
        return existingSector;
      }
      const newSector = await Sector.create({ // MUST BE THE FRENCH NAME !!!!!!!! the english name etc should be in alliases
        [attributesSector.sector_name]: sector
      });
      return newSector;
    } 
    catch (error) {
      console.error(`Error adding sector ${sector} to database:`, error);
      throw error;
    }
  }
}