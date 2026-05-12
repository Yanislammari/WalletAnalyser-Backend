import { Currency } from "../db_schema";
import { CurrencyResponseDto } from "../dtos/currency/responses/currency.response.dto";

class CurrencyMapper {
  public currencyEntityToResponseDto(currency: Currency): CurrencyResponseDto {
    return {
      uuid: currency.uuid,
      currencyName: currency.currency_name,
      createdAt: currency.createdAt,
      updatedAt: currency.updatedAt
    };
  }
}

export default CurrencyMapper;
