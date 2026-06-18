export interface PortfolioTotalResponseDto {
  totalInvested: number;
  totalSells: number;
  totalDividends: number;
  netTotal: number;
  portfolioMarketValue: number;  // current market value of all held positions
  totalValue: number;            // portfolioMarketValue + totalSells + totalDividends
  currencyId: string;
  currencyName: string;
}
