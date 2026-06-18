import { Request, Response } from "express";
import CurrencyService from "../services/currency.service";
import { CurrencyResponseDto } from "../dtos/currency/responses/currency.response.dto";

class CurrencyController {
  private readonly currencyService: CurrencyService;

  constructor() {
    this.currencyService = new CurrencyService();
  }

  public async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const currencies: CurrencyResponseDto[] = await this.currencyService.getAllCurrencies();
      return res.status(200).json(currencies);
    }
    catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getByName(req: Request, res: Response): Promise<Response> {
    try {
      const name: string = req.params.name as string;
      const currency: CurrencyResponseDto | null = await this.currencyService.getCurrencyByName(name);
      if (!currency) {
        return res.status(404).json({ message: "Currency not found" });
      }
      return res.status(200).json(currency);
    }
    catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async convert(req: Request, res: Response): Promise<Response> {
    try {
      const from: string = (req.query.from as string)?.toUpperCase();
      const to: string = (req.query.to as string)?.toUpperCase();
      const amount: number = parseFloat(req.query.amount as string);

      if (!from || !to || isNaN(amount)) {
        return res.status(400).json({ message: "Missing or invalid query params: from, to, amount" });
      }

      const convertedAmount: number = await this.currencyService.convertPrice(from, to, amount);
      return res.status(200).json({ from, to, amount, convertedAmount });
    }
    catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default CurrencyController;
