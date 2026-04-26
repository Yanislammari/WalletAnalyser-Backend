import { SectorRepository } from "../../repositories";
import { attributesSector, Sector } from "../../db_schema";
import { SectorNameDto, SectorsNameDto } from "../../dtos/sector/sector";

export class SectorService {
  private readonly sectorRepository: SectorRepository;

  constructor() {
    this.sectorRepository = new SectorRepository();
  }

  public async getSectors(): Promise<SectorsNameDto> {
    const sectors : SectorNameDto[] = await this.sectorRepository.get({
      order: [[attributesSector.sector_name, "ASC"]],
    }, [
      attributesSector.uuid,
      attributesSector.sector_name
    ])
    return { sectors : sectors } as SectorsNameDto
  }

  public async createSector(country_name: string): Promise<Sector> {
    const sector = await this.sectorRepository.addSectorToDatabase(country_name);
    return sector
  }

  public async updateSector(uuid: string, name: string): Promise<Sector | null> {
    const sector : Sector | null = await this.sectorRepository.update(uuid, {
      [attributesSector.sector_name]: name
    });
    if (!sector) return null;
    return sector
  }

  public async deleteSector(uuid: string): Promise<boolean> {
    return await this.sectorRepository.remove(uuid);
  }
}
