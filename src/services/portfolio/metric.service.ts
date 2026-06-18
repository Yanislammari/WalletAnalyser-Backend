import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { Currency } from "../../db_schema";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user.asset.buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user.asset.sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user.asset.dividend.repository";
import { MetricResponseDto, TopHolding, MonthlyDataPoint } from "../../dtos/portfolio/responses/metric.response.dto";
import { CurrenciesRepository } from "../../repositories";

const RISK_FREE_RATE = 0.04; // 4% annual (approximation of 10-year bond)

type FlowType = "buy" | "sell" | "dividend";

interface CashFlow {
  date: Date;
  amount: number; // already converted to target currency
  type: FlowType;
  company?: string;
}

export class MetricService {
  private readonly buyRepository: UserAssetBuyRepository;
  private readonly sellRepository: UserAssetSellRepository;
  private readonly dividendRepository: UserAssetDividendRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private rateCache: Map<string, number> = new Map();

  constructor() {
    this.buyRepository = new UserAssetBuyRepository();
    this.sellRepository = new UserAssetSellRepository();
    this.dividendRepository = new UserAssetDividendRepository();
    this.currenciesRepository = new CurrenciesRepository();
  }

  public async getMetrics(portfolioId: string, currencyId: string): Promise<MetricResponseDto> {
    this.rateCache.clear();

    const targetCurrency: Currency | null = await this.currenciesRepository.getById(currencyId);
    if (!targetCurrency) throw new Error("CURRENCY_NOT_FOUND");

    const [buys, sells, dividends] = await Promise.all([
      this.buyRepository.getAllByPortfolioId(portfolioId),
      this.sellRepository.getAllByPortfolioId(portfolioId),
      this.dividendRepository.getAllByPortfolioId(portfolioId),
    ]);

    if (buys.length === 0) {
      return this.emptyMetrics(targetCurrency);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Convert all transactions to target currency
    const flows: CashFlow[] = [];

    for (const buy of buys) {
      const amount = this.buyAmount(buy);
      if (amount == null) continue;
      const rate = await this.getRate(buy.buy_currency_uuid, currencyId, new Date(buy.buy_date));
      flows.push({ date: new Date(buy.buy_date), amount: amount * rate, type: "buy", company: buy.company_name ?? undefined });
    }

    for (const sell of sells) {
      const amount = this.sellAmount(sell);
      if (amount == null) continue;
      const rate = await this.getRate(sell.sell_currency_uuid, currencyId, new Date(sell.sell_date));
      flows.push({ date: new Date(sell.sell_date), amount: amount * rate, type: "sell", company: sell.company_name ?? undefined });
    }

    for (const div of dividends) {
      const exDate = new Date(div.cashflow_date);
      if (exDate > today) continue; // skip future dividends
      const rate = await this.getRate(div.currency_uuid, currencyId, exDate);
      flows.push({ date: exDate, amount: div.cashflow_amount * rate, type: "dividend" });
    }

    flows.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (flows.length === 0) return this.emptyMetrics(targetCurrency);

    // Aggregate totals
    const totalInvested = flows.filter(f => f.type === "buy").reduce((s, f) => s + f.amount, 0);
    const totalSells    = flows.filter(f => f.type === "sell").reduce((s, f) => s + f.amount, 0);
    const totalDividends = flows.filter(f => f.type === "dividend").reduce((s, f) => s + f.amount, 0);
    const totalReturned = totalSells + totalDividends;
    const gain = totalReturned - totalInvested;
    const gainPercent = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

    // Time period
    const firstBuy = flows.find(f => f.type === "buy")!;
    const periodYears = (today.getTime() - firstBuy.date.getTime()) / (365.25 * 24 * 3600 * 1000);

    // CAGR
    const cagr = periodYears > 0.01
      ? (Math.pow(Math.max(1 + gainPercent / 100, 1e-10), 1 / periodYears) - 1) * 100
      : gainPercent;

    // Volatility & Sharpe
    const volatility = this.computeVolatility(flows, today);
    const sharpeRatio = volatility > 0.01
      ? (cagr / 100 - RISK_FREE_RATE) / (volatility / 100)
      : 0;

    // Dividend yield
    const dividendYield = totalInvested > 0 ? (totalDividends / totalInvested) * 100 : 0;

    // Top holdings
    const topHoldings = this.computeTopHoldings(flows, totalInvested);

    // Monthly data for chart
    const monthlyData = this.computeMonthlyData(flows, today);

    return {
      totalInvested:   this.round(totalInvested),
      totalReturned:   this.round(totalReturned),
      gain:            this.round(gain),
      gainPercent:     this.round(gainPercent),
      cagr:            this.round(cagr),
      volatility:      this.round(volatility),
      sharpeRatio:     this.round(sharpeRatio),
      totalDividends:  this.round(totalDividends),
      dividendYield:   this.round(dividendYield),
      firstBuyDate:    firstBuy.date.toISOString().split("T")[0],
      periodYears:     Math.round(periodYears * 10) / 10,
      topHoldings,
      monthlyData,
      currencyId:      targetCurrency.uuid,
      currencyName:    targetCurrency.currency_name,
    };
  }

  // ─── Volatility ──────────────────────────────────────────────────────────────

  private computeVolatility(flows: CashFlow[], today: Date): number {
    // Build monthly buckets
    const monthlyBuys    = new Map<string, number>();
    const monthlyInflows = new Map<string, number>();

    for (const f of flows) {
      const key = this.monthKey(f.date);
      if (f.type === "buy") {
        monthlyBuys.set(key, (monthlyBuys.get(key) ?? 0) + f.amount);
      }
      else {
        monthlyInflows.set(key, (monthlyInflows.get(key) ?? 0) + f.amount);
      }
    }

    const firstKey  = this.monthKey(flows[0].date);
    const lastKey   = this.monthKey(today);
    const monthlyReturns: number[] = [];
    let cumulativeInvested = 0;
    let current = this.parseMonthKey(firstKey);
    const end   = this.parseMonthKey(lastKey);

    while (current <= end) {
      const key   = this.monthKey(current);
      const buys  = monthlyBuys.get(key) ?? 0;
      const inflows = monthlyInflows.get(key) ?? 0;

      if (cumulativeInvested > 0) {
        monthlyReturns.push((inflows - buys) / cumulativeInvested);
      }

      cumulativeInvested += buys;
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    if (monthlyReturns.length < 2) return 0;

    const mean = monthlyReturns.reduce((s, v) => s + v, 0) / monthlyReturns.length;
    const variance = monthlyReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (monthlyReturns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(12) * 100; // annualize
  }

  // ─── Monthly data for chart ───────────────────────────────────────────────

  private computeMonthlyData(flows: CashFlow[], today: Date): MonthlyDataPoint[] {
    const monthlyBuys    = new Map<string, number>();
    const monthlyInflows = new Map<string, number>();

    for (const f of flows) {
      const key = this.monthKey(f.date);
      if (f.type === "buy") {
        monthlyBuys.set(key, (monthlyBuys.get(key) ?? 0) + f.amount);
      }
      else {
        monthlyInflows.set(key, (monthlyInflows.get(key) ?? 0) + f.amount);
      }
    }

    const points: MonthlyDataPoint[] = [];
    let cumInvested = 0;
    let cumReturned = 0;
    let current = this.parseMonthKey(this.monthKey(flows[0].date));
    const end   = this.parseMonthKey(this.monthKey(today));

    while (current <= end) {
      const key = this.monthKey(current);
      cumInvested += monthlyBuys.get(key) ?? 0;
      cumReturned += monthlyInflows.get(key) ?? 0;

      points.push({
        month:    key,
        netGain:  this.round(cumReturned - cumInvested),
        invested: this.round(cumInvested),
      });

      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return points;
  }

  // ─── Top holdings ────────────────────────────────────────────────────────

  private computeTopHoldings(flows: CashFlow[], totalInvested: number): TopHolding[] {
    const netByCompany = new Map<string, number>();

    for (const f of flows) {
      if (!f.company) continue;
      const current = netByCompany.get(f.company) ?? 0;
      if (f.type === "buy") {
        netByCompany.set(f.company, current + f.amount);
      }
      else if (f.type === "sell") {
        netByCompany.set(f.company, current - f.amount);
      }
    }

    return Array.from(netByCompany.entries())
      .filter(([, net]) => net > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([company, invested]) => ({
        companyName: company,
        invested:   this.round(invested),
        allocation: totalInvested > 0 ? this.round((invested / totalInvested) * 100) : 0,
      }));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private buyAmount(buy: UserAssetBuy): number | null {
    return buy.asset_buy_amount ??
      (buy.asset_buy_share != null && buy.asset_buy_price_per_share != null
        ? buy.asset_buy_share * buy.asset_buy_price_per_share
        : null);
  }

  private sellAmount(sell: UserAssetSell): number | null {
    return sell.asset_sell_amount ??
      (sell.asset_sell_share != null && sell.average_asset_share_buy_price != null
        ? sell.asset_sell_share * sell.average_asset_share_buy_price
        : null);
  }

  private async getRate(sourceCurrencyId: string, targetCurrencyId: string, date: Date): Promise<number> {
    if (sourceCurrencyId === targetCurrencyId) return 1;
    const key = `${sourceCurrencyId}→${targetCurrencyId}@${date.toISOString().split("T")[0]}`;
    if (this.rateCache.has(key)) return this.rateCache.get(key)!;
    try {
      const forex = await this.currenciesRepository.getClosestForexRateBeforeOrAt(sourceCurrencyId, targetCurrencyId, date);
      const rate = forex?.forex_rate ?? 1;
      this.rateCache.set(key, rate);
      return rate;
    }
    catch { return 1; }
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private parseMonthKey(key: string): Date {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private emptyMetrics(currency: Currency): MetricResponseDto {
    return {
      totalInvested: 0, totalReturned: 0, gain: 0, gainPercent: 0,
      cagr: 0, volatility: 0, sharpeRatio: 0,
      totalDividends: 0, dividendYield: 0,
      firstBuyDate: null, periodYears: 0,
      topHoldings: [], monthlyData: [],
      currencyId: currency.uuid, currencyName: currency.currency_name,
    };
  }
}
