import { Sector, SectorAllias, attributesSector, attributesSectorAllias } from "../../db_schema";

export class SectorRepository {
  constructor() {}

  async getSectorByName(sectorName: string): Promise<Sector | null> {
    try {
      const sector = await Sector.findOne({
        where: {
          [attributesSector.sector_name]: sectorName,
        },
      });

      if (sector) return sector;
      const alias = await SectorAllias.findOne({
        where: {
          [attributesSectorAllias.sector_allias_name]: sectorName,
        },
        include: [
          {
            as: "sector",
            model: Sector,
            required: true,
          },
        ],
      });
      return alias ? alias.sector : null;
    } catch (error) {
      console.error(`Error fetching ${sectorName}`, error);
      return null;
    }
  }

  async addSectorToDatabase(sector: string): Promise<Sector> {
    try {
      const existingSector = await this.getSectorByName(sector);
      if (existingSector) {
        return existingSector;
      }
      const newSector = await Sector.create({
        // MUST BE THE FRENCH NAME !!!!!!!! the english name etc should be in alliases
        [attributesSector.sector_name]: sector,
      });
      return newSector;
    } catch (error) {
      console.error(`Error adding sector ${sector} to database:`, error);
      throw error;
    }
  }
}
