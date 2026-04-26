import { Request, Response } from "express";
import { SectorAlliasService } from "../services/sector/sector_allias.services";

class SectorAlliasController {
  private readonly sectorAlliasService: SectorAlliasService;

  constructor() {
    this.sectorAlliasService = new SectorAlliasService();
  }

  public async getSectorAllias(req: Request, res: Response): Promise<Response> {
    try {
      const sector_uuid = req.params.sector_uuid as string
      const response = await this.sectorAlliasService.getAllSectorAllias(sector_uuid);
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createSectorAllias(req: Request, res: Response): Promise<Response> {
    try {
      const sector_uuid = req.params.sector_uuid as string
      const { sector_allias_name } = req.body;
      const sectorAllias = await this.sectorAlliasService.createSectorAllias(sector_uuid, sector_allias_name);
      return res.status(201).json(sectorAllias);
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateSectorAllias(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { sector_allias_name } = req.body;
      if (!sector_allias_name) {
        return res.status(400).json({ message: "sector_allias_name is required" });
      }
      const sectorAllias = await this.sectorAlliasService.updateSectorAllias(uuid, sector_allias_name);
      if (!sectorAllias) {
        return res.status(404).json({ message: "Sector alias not found" });
      }
      return res.status(200).json(sectorAllias);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteSectorAllias(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.sectorAlliasService.deleteSectorAllias(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Sector alias not found" });
      }
      return res.status(200).json({ message: "Sector alias deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default SectorAlliasController;