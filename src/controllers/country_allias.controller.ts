import { Request, Response } from "express";
import { CountryAlliasService } from "../services/country/country_allias.services";

class CountryAlliasController {
  private readonly countryAlliasService: CountryAlliasService;

  constructor() {
    this.countryAlliasService = new CountryAlliasService();
  }

  public async getCountryAllias(req: Request, res: Response): Promise<Response> {
    try {
      const country_uuid = req.params.country_uuid as string 
      const response = await this.countryAlliasService.getAllCountryAllias(country_uuid);
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createCountryAllias(req: Request, res: Response): Promise<Response> {
    try {
      const country_uuid = req.params.country_uuid as string
      const { country_allias_name } = req.body;
      const countryAllias = await this.countryAlliasService.createCountryAllias(country_uuid, country_allias_name);
      return res.status(201).json(countryAllias);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateCountryAllias(req: Request, res: Response): Promise<Response> {
    try {
      const uuid  = req.params.uuid as string;
      const { country_allias_name } = req.body;
      if (!country_allias_name) {
        return res.status(400).json({ message: "country_allias_name is required" });
      }
      const countryAllias = await this.countryAlliasService.updateCountryAllias(uuid, country_allias_name);
      if (!countryAllias) {
        return res.status(404).json({ message: "Country alias not found" });
      }
      return res.status(200).json(countryAllias);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteCountryAllias(req: Request, res: Response): Promise<Response> {
    try {
      const uuid  = req.params.uuid as string;
      const deleted = await this.countryAlliasService.deleteCountryAllias(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Country alias not found" });
      }
      return res.status(200).json({ message: "Country alias deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default CountryAlliasController;