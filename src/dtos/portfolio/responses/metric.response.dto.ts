export interface TopHolding {
  companyName: string;
  invested: number;
  allocation: number; // % of total market value (or invested if no prices)
}

export interface AllocationItem {
  name: string;        // sector or country name
  value: number;       // market value in target currency
  allocation: number;  // % of total portfolio market value
}

export interface MonthlyDataPoint {
  month: string;           // "2024-01"
  netGain: number;         // cumulative net gain at end of month (realized)
  invested: number;        // cumulative invested at end of month
  netCostBasis: number;    // cumulative buys - cumulative sells (capital still deployed)
  marketValue: number;     // real portfolio market value = Σ(shares × price) at end of month; 0 if no price data
}

export interface DrawdownPoint {
  month: string;
  drawdown: number;    // % below peak (always <= 0 conceptually, stored as positive %)
}

export interface MonthlyTwrPoint {
  month: string;       // "2024-01"
  cumTwr: number;      // cumulative chain-linked TWR (%) from portfolio start
}

export interface DashboardResponseDto {
  monthlyData:      MonthlyDataPoint[];
  topHoldings:      TopHolding[];
  sectorBreakdown:  AllocationItem[];
  countryBreakdown: AllocationItem[];
  currencyId:   string;
  currencyName: string;
}

export interface MetricResponseDto {
  // Core financials (realized only — sells + dividends)
  totalInvested: number;
  totalReturned: number;   // sells + dividends
  gain: number;            // totalReturned - totalInvested  (realized)
  gainPercent: number;     // gain / totalInvested * 100     (realized)

  // Mark-to-market (realized + current market value of held positions)
  portfolioMarketValue: number;  // current market value of open positions
  gainMtm: number;               // (totalReturned + portfolioMarketValue) - totalInvested
  gainPercentMtm: number;        // gainMtm / totalInvested * 100
  cagrMtm: number;               // gainPercentMtm annualized
  xirrMtm: number;               // XIRR treating portfolioMarketValue as final sell today

  // Performance (derived from cash-flow series — unaffected by MTM to avoid distortion)
  cagr: number;            // annualized realized gainPercent (%)
  volatility: number;      // annualized std dev of monthly returns (%)
  sharpeRatio: number;     // (twrAnnualized - riskFreeRate) / volatility
  sortinoRatio: number;    // (twrAnnualized - riskFreeRate) / downside deviation
  twr: number;             // time-weighted return (%)
  twrAnnualized: number;   // TWR annualized (% per year)
  logTwr: number;          // ln(1 + TWR/100) * 100 — continuous log return (%)
  xirr: number;            // XIRR on realized cash flows only (%)

  // Drawdown
  maxDrawdown: number;           // largest peak-to-trough drop in realized value (%)
  maxDrawdownDurationMonths: number; // length of the worst drawdown in months

  // Income
  totalDividends: number;
  dividendYield: number;   // totalDividends / totalInvested * 100

  // Context
  firstBuyDate: string | null;
  periodYears: number;

  // Breakdown
  topHoldings: TopHolding[];
  sectorBreakdown: AllocationItem[];
  countryBreakdown: AllocationItem[];
  monthlyData: MonthlyDataPoint[];
  monthlyTwr: MonthlyTwrPoint[];   // chain-linked cumulative TWR per month (for comparison chart)

  currencyId: string;
  currencyName: string;
}
