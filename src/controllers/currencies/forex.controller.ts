import { Request, Response } from "express";
import { ForexService } from "../../services/currencies/forex.service";
import { ForexListMetaData } from "../../dtos/currencies/forex";
import path from "path";
import fs from "fs"

import { DateService, ExcelService } from "../../services";

class ForexController {
  private readonly forexService: ForexService;

  constructor() {
    this.forexService = new ForexService();
  }

  public async getExcelTemplate(req: Request, res: Response): Promise<void | Response> {
    try {
      const filePath = path.join(
        process.cwd(),
        "src/asset/excel/forex.xlsx"
      );
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({message: "File not found"});
      }
      res.download(filePath, "forex_template.xlsx");
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getAllForex(req: Request, res: Response): Promise<Response> {
    try {
      const response = await this.forexService.getAllForex();
      const forexList: ForexListMetaData = { forex_list: response };
      return res.status(200).json(forexList);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createForex(req: Request, res: Response): Promise<Response> {
    try {
      const { base_currency_uuid } = req.body;
      const file = req.file;

      if (!base_currency_uuid || !file) {
        return res.status(400).json({ message: "base_currency, quote_currency and file are required" });
      }

      const forex = await this.forexService.createForex(file, base_currency_uuid);
      return res.status(201).json(forex);
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate")) {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }
      if (error instanceof Error && error.message == "WRONG_FORMAT") {
        return res.status(500).json({ message: "Are you sure it is a xlsx formatting ?" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateForex(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { base_currency_uuid, quote_currency_uuid } = req.body;

      if (!base_currency_uuid || !quote_currency_uuid) {
        return res.status(500).json({ message: "base_currency and quote_currency are required" });
      }
      else if(base_currency_uuid === quote_currency_uuid){
        return res.status(500).json({ message: "base_currency and quote_currency must be different" });
      }

      const forex = await this.forexService.updateForex(uuid, base_currency_uuid, quote_currency_uuid);
      if (!forex) {
        return res.status(404).json({ message: "Forex not found" });
      }
      return res.status(200).json(forex);
    } catch (error) {
      if (error instanceof Error && error.message =="ALREADY_FOREX") {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteForex(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.forexService.deleteForex(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Forex not found" });
      }
      return res.status(200).json({ message: "Forex deleted successfully" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default ForexController;