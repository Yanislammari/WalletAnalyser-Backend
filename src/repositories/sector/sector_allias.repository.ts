import { Op } from "sequelize";
import { Sector, SectorAllias, attributesSectorAllias } from "../../db_schema";

export class SectorAlliasRepository {
  constructor() {}

  async getSectorAlliasByName(sectorAlliasName: string): Promise<SectorAllias | null> {
    try {
      const existingSectorAllias =
        (await SectorAllias.findOne({
          where: {
            [attributesSectorAllias.sector_allias_name]: {
              [Op.iLike]: sectorAlliasName,
            },
          },
          include: [
            {
              model: Sector,
              as: "sector", // must match the alias in association
            },
          ],
        })) || null;
      return existingSectorAllias;
    } catch (error) {
      console.error(`Error fetching allias sector ${sectorAlliasName}`, error);
      return null;
    }
  }

  async addSectorAlliasToDatabase(officialSectorUuid: string, sectorAlliasName: string): Promise<SectorAllias> {
    try {
      const existingSectorAllias = await this.getSectorAlliasByName(sectorAlliasName);
      if (existingSectorAllias) {
        return existingSectorAllias;
      }
      const newAlliasSector = await SectorAllias.create({
        [attributesSectorAllias.sector_uuid]: officialSectorUuid,
        [attributesSectorAllias.sector_allias_name]: sectorAlliasName,
      });
      return newAlliasSector;
    } catch (error) {
      console.error(`Error adding sector allias ${sectorAlliasName} to database:`, error);
      throw error;
    }
  }
}
