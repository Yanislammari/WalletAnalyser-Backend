import { Request, Response } from "express";
import { CountryService } from "../services/country.services";
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
}

export default CountryController;