export interface AddAssetDividendRequestDto {
  portfolioId: string;
  assetId?: string;
  currencyId: string;
  cashflowDate: string;
  cashflowAmount: number;
}
