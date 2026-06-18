import { Currency } from "../db_schema";
import { CurrencyResponseDto } from "../dtos/currency/responses/currency.response.dto";
import CurrencyMapper from "../mappers/currency.mapper";
import { CurrenciesRepository } from "../repositories";
import { YahooFinanceService } from "./yahoo.finance.service";

class CurrencyService {
  private readonly currencyRepository: CurrenciesRepository;
  private readonly currencyMapper: CurrencyMapper;
  private readonly yahooFinanceService: YahooFinanceService;

  constructor() {
    this.currencyRepository = new CurrenciesRepository();
    this.currencyMapper = new CurrencyMapper();
    this.yahooFinanceService = new YahooFinanceService();
  }

  public async getAllCurrencies(): Promise<CurrencyResponseDto[]> {
    const currencies: Currency[] = await this.currencyRepository.get();
    return currencies.map((currency) => this.currencyMapper.currencyEntityToResponseDto(currency));
  }

  public async getCurrencyByName(name: string): Promise<CurrencyResponseDto | null> {
    const currency: Currency | null = await this.currencyRepository.getByName(name.toUpperCase());
    if (!currency) {
      return null;
    }

    return this.currencyMapper.currencyEntityToResponseDto(currency);
  }

  public async convertPrice(from: string, to: string, amount: number): Promise<number> {
    const rate: number = await this.yahooFinanceService.getExchangeRate(from, to);
    return parseFloat((amount * rate).toFixed(6));
  }
}

export default CurrencyService;
