export interface AddAssetDividendRequestDto {
  portfolioId: string;
  currencyId: string;
  cashflowDate: string;
  cashflowAmount: number;
}
