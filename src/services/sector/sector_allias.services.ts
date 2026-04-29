import { SectorAlliasRepository, SectorRepository } from "../../repositories";
import { attributesSectorAllias, Sector, SectorAllias } from "../../db_schema";
import { SectorAlliasNameDto, SectorsAlliasNameDto } from "../../dtos/sector/sector_allias";

export class SectorAlliasService {
  private readonly sectorAlliasRepository: SectorAlliasRepository;
  private readonly sectorRepository : SectorRepository;

  constructor() {
    this.sectorAlliasRepository = new SectorAlliasRepository();
    this.sectorRepository = new SectorRepository();
  }

  public async getAllSectorAllias(sector_uuid : string): Promise<SectorsAlliasNameDto> {
    const sector : Sector | null = await this.sectorRepository.getById(sector_uuid);
    if (!sector) {
      throw new Error("Sector not found");
    }
    const allias : SectorAlliasNameDto[] = await this.sectorAlliasRepository.get({
      where : {[attributesSectorAllias.sector_uuid] : sector_uuid},
      order: [[attributesSectorAllias.sector_allias_name, "ASC"]],
    }, [
      attributesSectorAllias.uuid,
      attributesSectorAllias.sector_allias_name
    ]);
    return { sector : sector, sectors_allias: allias };
  }

  public async createSectorAllias(sector_uuid: string, sector_allias_name: string): Promise<SectorAllias> {
    return this.sectorAlliasRepository.addSectorAlliasToDatabase(sector_uuid, sector_allias_name);
  }

  public async updateSectorAllias(uuid: string, sector_allias_name: string): Promise<SectorAllias | null> {
    const sectorAllias = await this.sectorAlliasRepository.update(uuid, {
      [attributesSectorAllias.sector_allias_name]: sector_allias_name
    });
    if (!sectorAllias) return null;
    return sectorAllias;
  }

  public async deleteSectorAllias(uuid: string): Promise<boolean> {
    return await this.sectorAlliasRepository.remove(uuid);
  }
}