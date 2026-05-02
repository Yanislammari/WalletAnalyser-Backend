import { Request, Response } from "express";
import { RfrRatesService } from "../../services/rfr/rfr_rates.service";

class RfrRatesController {
  private readonly rfrRatesService: RfrRatesService;

  constructor() {
    this.rfrRatesService = new RfrRatesService();
  }

  public async getAllRfrRates(req: Request, res: Response): Promise<Response> {
    try {
      const rfr_country_uuid = req.params.rfr_country_uuid as string;
      const offset = Number(req.query.offset) || 0;
      const size = Number(req.query.size) || 10;
      const response = await this.rfrRatesService.getAllRfrRates(rfr_country_uuid, offset, size);
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createRfrRate(req: Request, res: Response): Promise<Response> {
    try {
      const rfr_country_uuid = req.params.rfr_country_uuid as string;
      const { rfr_date, rfr_percent_rate } = req.body;
      
      if (!rfr_date || rfr_percent_rate === undefined) {
        return res.status(400).json({ message: "rfr_date and rfr_percent_rate are required" });
      }
      
      const rfrRate = await this.rfrRatesService.createRfrRate(rfr_country_uuid, new Date(rfr_date), parseFloat(rfr_percent_rate));
      return res.status(201).json(rfrRate);
    } catch (error) {
      /**if (error instanceof Error && error.message.includes("la valeur d'une clé dupliquée rompt la contrainte unique")) {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }**/
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateRfrRate(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { rfr_date, rfr_percent_rate } = req.body;
      
      if (!rfr_date && rfr_percent_rate === undefined) {
        return res.status(400).json({ message: "rfr_date or rfr_percent_rate is required" });
      }
      
      const updateData: { rfr_date?: Date; rfr_percent_rate?: number } = {};
      if (rfr_date) updateData.rfr_date = new Date(rfr_date);
      if (rfr_percent_rate !== undefined) updateData.rfr_percent_rate = parseFloat(rfr_percent_rate);
      
      const rfrRate = await this.rfrRatesService.updateRfrRate(uuid, updateData);
      if (!rfrRate) {
        return res.status(404).json({ message: "RFR rate not found" });
      }
      return res.status(200).json(rfrRate);
    } catch (error) {
      if (error instanceof Error && error.message.includes("la valeur d'une clé dupliquée rompt la contrainte unique")) {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteRfrRate(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.rfrRatesService.deleteRfrRate(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "RFR rate not found" });
      }
      return res.status(200).json({ message: "RFR rate deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default RfrRatesController;