import { Request, Response } from "express";
import { CountryService } from "../services/country/country.services";
import { CountriesNameDto } from "../dtos/country/country";

class CountryController {
  private readonly countryService: CountryService;

  constructor() {
    this.countryService = new CountryService();
  }

  public async getCountries(req: Request, res: Response): Promise<Response> {
    try {
      const response: CountriesNameDto = await this.countryService.getCountries();
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createCountry(req: Request, res: Response): Promise<Response> {
    try {
      const { country_name } = req.body;
      const country = await this.countryService.addCountries(country_name);
      return res.status(201).json(country);
    } catch (error) {
      if(error instanceof Error && error.message.includes("la valeur d'une clé dupliquée rompt la contrainte unique")) {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateCountry(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { country_name } = req.body;
      const country = await this.countryService.updateCountry(uuid, country_name);
      if (!country) {
        return res.status(404).json({ message: "Country not found" });
      }
      return res.status(200).json(country);
    } catch (error) {
      if(error instanceof Error && error.message.includes("la valeur d'une clé dupliquée rompt la contrainte unique")) {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteCountry(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.countryService.deleteCountry(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Country not found" });
      }
      return res.status(200).json({ message: "Country deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default CountryController;