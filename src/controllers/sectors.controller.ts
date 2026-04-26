import { Request, Response } from "express";
import { SectorService } from "../services/sector.services";
import { SectorsNameDto } from "../dtos/sector/sector";

class SectorController {
  private readonly sectorService: SectorService;

  constructor() {
    this.sectorService = new SectorService();
  }

  public async getSectors(req: Request, res: Response): Promise<Response> {
    try {
      const response: SectorsNameDto = await this.sectorService.getSectors();
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createSector(req: Request, res: Response): Promise<Response> {
    try {
      const { sector_name } = req.body;
      const sector = await this.sectorService.createSector(sector_name);
      return res.status(201).json(sector);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateSector(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { sector_name } = req.body;
      const sector = await this.sectorService.updateSector(uuid, sector_name);
      if (!sector) {
        return res.status(404).json({ message: "Sector not found" });
      }
      return res.status(200).json(sector);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteSector(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.sectorService.deleteSector(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Sector not found" });
      }
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default SectorController;
