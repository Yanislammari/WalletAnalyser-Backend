export interface TopHolding {
  companyName: string;
  invested: number;
  allocation: number; // % of total invested
}

export interface MonthlyDataPoint {
  month: string;       // "2024-01"
  netGain: number;     // cumulative net gain at end of month
  invested: number;    // cumulative invested at end of month
}

export interface MetricResponseDto {
  // Core financials
  totalInvested: number;
  totalReturned: number;   // sells + dividends
  gain: number;            // totalReturned - totalInvested
  gainPercent: number;     // gain / totalInvested * 100

  // Performance
  cagr: number;            // compound annual growth rate (%)
  volatility: number;      // annualized std dev of monthly returns (%)
  sharpeRatio: number;     // (cagr - riskFreeRate) / volatility

  // Income
  totalDividends: number;
  dividendYield: number;   // totalDividends / totalInvested * 100

  // Context
  firstBuyDate: string | null;
  periodYears: number;

  // Breakdown
  topHoldings: TopHolding[];
  monthlyData: MonthlyDataPoint[];

  currencyId: string;
  currencyName: string;
}
