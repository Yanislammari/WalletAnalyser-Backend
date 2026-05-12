import { Request, Response } from "express";
import { ForexRatesService } from "../../services/currencies/forex_rates.service";

class ForexRatesController {
  private readonly forexRatesService: ForexRatesService;

  constructor() {
    this.forexRatesService = new ForexRatesService();
  }

  public async getAllForexRates(req: Request, res: Response): Promise<Response> {
    try {
      const forex_uuid = req.params.forex_uuid as string;
      const offset = Number(req.query.offset) || 0;
      const size = Number(req.query.size) || 100;
      let from: Date | null = new Date(req.query.from as string);
      let to: Date | null = new Date(req.query.to as string);

      if (isNaN(from.getTime())) {
        from = null;
      }
      if (isNaN(to.getTime())) {
        to = null;
      }

      const response = await this.forexRatesService.getAllForexRates(forex_uuid, offset, size, from, to);
      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === "NO_FOREX") {
        return res.status(404).json({ message: "Forex not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createForexRate(req: Request, res: Response): Promise<Response> {
    try {
      const forex_uuid = req.params.forex_uuid as string;
      const { forex_rate_date, forex_rate } = req.body;

      if (!forex_rate_date || forex_rate === undefined) {
        return res.status(500).json({ message: "forex_rate_date and forex_rate are required" });
      }

      const forexRate = await this.forexRatesService.createForexRate(
        forex_uuid,
        new Date(forex_rate_date),
        parseFloat(forex_rate)
      );
      return res.status(201).json(forexRate);
    } catch (error) {
      if (error instanceof Error && error.message === "EXIST") {
        return res.status(500).json({ message: "Une valeur à cette date existe déjà" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateForexRate(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { forex_rate_date, forex_rate } = req.body;

      if (!forex_rate_date && forex_rate === undefined) {
        return res.status(400).json({ message: "forex_rate_date or forex_rate is required" });
      }

      const updateData: { forex_rate_date?: Date; forex_rate?: number } = {};
      if (forex_rate_date) {
        updateData.forex_rate_date = new Date(forex_rate_date);
      }
      if (forex_rate !== undefined) {
        updateData.forex_rate = parseFloat(forex_rate);
      }

      const forexRate = await this.forexRatesService.updateForexRate(uuid, updateData);
      if (!forexRate) {
        return res.status(404).json({ message: "Forex rate not found" });
      }
      return res.status(200).json(forexRate);
    } catch (error) {
      if (error instanceof Error && error.message === "EXIST") {
        return res.status(500).json({ message: "Une valeur à cette date existe déjà" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteForexRate(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.forexRatesService.deleteForexRate(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Forex rate not found" });
      }
      return res.status(200).json({ message: "Forex rate deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default ForexRatesController;
