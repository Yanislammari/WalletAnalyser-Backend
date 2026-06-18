export interface CurrencyNameDto {
  uuid: string;
  currency_name: string;
}

export interface CurrenciesNameDto {
  currencies: CurrencyNameDto[];
}