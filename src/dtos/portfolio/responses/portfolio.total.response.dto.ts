export interface PortfolioTotalResponseDto {
  totalInvested: number;
  totalSells: number;
  totalDividends: number;
  netTotal: number;
  currencyId: string;
  currencyName: string;
}
