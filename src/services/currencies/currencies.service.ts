import { CurrenciesRepository } from "../../repositories";
import { attributesCurrency, Currency } from "../../db_schema";
import { CurrenciesNameDto, CurrencyNameDto } from "../../dtos/currencies/currency";


export class CurrenciesService {
  private readonly currenciesRepository: CurrenciesRepository;

  constructor() {
    this.currenciesRepository = new CurrenciesRepository();
  }

  public async getCurrencies(): Promise<CurrenciesNameDto> {
    const currencies: CurrencyNameDto[] = await this.currenciesRepository.get({
      order: [[attributesCurrency.currency_name, "ASC"]],
    }, [
      attributesCurrency.uuid,
      attributesCurrency.currency_name
    ])
    return { currencies: currencies } as CurrenciesNameDto
  }

  public async addCurrencies(currency_name : string): Promise<Currency>{
    const name = currency_name.toUpperCase()
    const currency = await this.currenciesRepository.add({currency_name : name})
    return currency
  }

  public async updateCurrency(uuid: string, currency_name: string): Promise<CurrencyNameDto | null>{
    const name = currency_name.toUpperCase()
    const currency = await this.currenciesRepository.update(uuid, {currency_name : name})
    return currency
  }

  public async deleteCurrency(uuid: string): Promise<boolean>{
    return await this.currenciesRepository.remove(uuid)
  }
}