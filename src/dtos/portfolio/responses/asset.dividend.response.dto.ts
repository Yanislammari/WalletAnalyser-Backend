export interface AssetDividendResponseDto {
  id: string;
  portfolioId: string;
  companyName: string | null;
  currencyId: string;
  cashflowDate: string;
  cashflowAmount: number;
  createdAt: Date;
  updatedAt: Date;
}
