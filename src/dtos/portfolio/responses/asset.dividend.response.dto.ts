export interface AssetDividendResponseDto {
  id: string;
  portfolioId: string;
  currencyId: string;
  cashflowDate: string;
  cashflowAmount: number;
  createdAt: Date;
  updatedAt: Date;
}
