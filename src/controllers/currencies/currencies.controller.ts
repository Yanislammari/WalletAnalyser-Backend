import { Request, Response } from "express";
import { CurrenciesService } from "../../services/currencies/currencies.service";
import { CurrenciesNameDto } from "../../dtos/currencies/currency";

class CurrenciesController {
  private readonly currenciesService: CurrenciesService;

  constructor() {
    this.currenciesService = new CurrenciesService();
  }

  public async getCurrencies(req: Request, res: Response): Promise<Response> {
    try {
      const response: CurrenciesNameDto = await this.currenciesService.getCurrencies();
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createCurrency(req: Request, res: Response): Promise<Response> {
    try {
      const { currency_name } = req.body;
      const currency = await this.currenciesService.addCurrencies(currency_name);
      return res.status(201).json(currency);
    } catch (error) {
      if(error instanceof Error && error.message.includes("la valeur d'une clé dupliquée rompt la contrainte unique")) {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateCurrency(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { currency_name } = req.body;
      const currency = await this.currenciesService.updateCurrency(uuid, currency_name);
      if (!currency) {
        return res.status(404).json({ message: "Currency not found" });
      }
      return res.status(200).json(currency);
    } catch (error) {
      if(error instanceof Error && error.message.includes("la valeur d'une clé dupliquée rompt la contrainte unique")) {
        return res.status(500).json({ message: "Cette valeur existe déjà" });
      }
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteCurrency(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.currenciesService.deleteCurrency(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Currency not found" });
      }
      return res.status(200).json({ message: "Currency deleted successfully" });
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default CurrenciesController;