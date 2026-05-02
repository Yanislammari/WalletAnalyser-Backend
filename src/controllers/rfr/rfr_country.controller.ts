import { Request, Response } from "express";
import { RfrCountryService } from "../../services/rfr/rfr_country.service";
import { RfrCountriesMetaData } from "../../dtos/rfr/rfr_country";
import path from "path";
import fs from "fs";
import XLSX from "xlsx"
import { DateService, ExcelService } from "../../services";

class RfrCountryController {
  private readonly rfrCountryService: RfrCountryService;
  private readonly excelService : ExcelService
  private readonly dateService : DateService

  constructor() {
    this.rfrCountryService = new RfrCountryService();
    this.excelService = new ExcelService();
    this.dateService = new DateService();
  }

  public async getExcelTemplate(req: Request, res: Response): Promise<void | Response> {
    try {
      const filePath = path.join(
        process.cwd(),
        "src/asset/excel/rfr/rfr_usa.xlsx"
      );
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({message: "File not found"});
      }
      res.download(filePath, "rfr_countries_template.xlsx");
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getAllRfrCountries(req: Request, res: Response): Promise<Response> {
    try {
      const response = await this.rfrCountryService.getAllRfrCountries();
      const rfrCountries : RfrCountriesMetaData = { rfr_countries : response }
      return res.status(200).json(rfrCountries);
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createRfrCountry(req: Request, res: Response): Promise<Response> {
    try {
      const { country_uuid } = req.body;
      const file = req.file;
      if (!country_uuid || !file) {
        return res.status(400).json({ message: "country_uuid and file are required" });
      }
      const workbook = XLSX.read(req.file?.buffer, {
        type: "buffer",
      });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const range = this.excelService.getExcelSize(worksheet);
      const dates = this.excelService.readExcelColumn(worksheet, 0, range).map(date => this.dateService.transformExcelDateToDbDate(date));
      const percent_rates = this.excelService.readExcelColumn(worksheet, 1, range);
      const rfrCountry = await this.rfrCountryService.createRfrCountry(country_uuid, dates, percent_rates);
      return res.status(201).json(rfrCountry);
    } catch (error) {
      console.log(error)
      if (error instanceof Error && error.message.includes("la valeur d'une clé dupliquée rompt la contrainte unique")) {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateRfrCountry(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { country_uuid } = req.body;
      if (!country_uuid) {
        return res.status(400).json({ message: "country_uuid is required" });
      }
      const rfrCountry = await this.rfrCountryService.updateRfrCountry(uuid, country_uuid);
      if (!rfrCountry) {
        return res.status(404).json({ message: "RFR Country not found" });
      }
      return res.status(200).json(rfrCountry);
    } catch (error) {
      if (error instanceof Error && error.message.includes("la valeur d'une clé dupliquée rompt la contrainte unique")) {
        return res.status(500).json({ message: "Il n'est pas possible d'avoir 2 rfr sur un seul pays" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteRfrCountry(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.rfrCountryService.deleteRfrCountry(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "RFR Country not found" });
      }
      return res.status(200).json({ message: "RFR Country deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default RfrCountryController;