import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { Currency } from "../../db_schema";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user.asset.buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user.asset.sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user.asset.dividend.repository";
import { MetricResponseDto, TopHolding, MonthlyDataPoint, MonthlyTwrPoint } from "../../dtos/portfolio/responses/metric.response.dto";
import { CurrenciesRepository } from "../../repositories";

const RISK_FREE_RATE = 0.04; // 4 % annual

type FlowType = "buy" | "sell" | "dividend";

interface CashFlow {
  date: Date;
  amount: number;
  type: FlowType;
  company?: string;
}

export class MetricService {
  private readonly buyRepository:      UserAssetBuyRepository;
  private readonly sellRepository:     UserAssetSellRepository;
  private readonly dividendRepository: UserAssetDividendRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private rateCache: Map<string, number> = new Map();

  constructor() {
    this.buyRepository      = new UserAssetBuyRepository();
    this.sellRepository     = new UserAssetSellRepository();
    this.dividendRepository = new UserAssetDividendRepository();
    this.currenciesRepository = new CurrenciesRepository();
  }

  // ─── Public entry point ────────────────────────────────────────────────────

  public async getMetrics(portfolioId: string, currencyId: string, fromDate?: string, portfolioMarketValue?: number): Promise<MetricResponseDto> {
    this.rateCache.clear();

    const targetCurrency: Currency | null = await this.currenciesRepository.getById(currencyId);
    if (!targetCurrency) throw new Error("CURRENCY_NOT_FOUND");

    const [buys, sells, dividends] = await Promise.all([
      this.buyRepository.getAllByPortfolioId(portfolioId),
      this.sellRepository.getAllByPortfolioId(portfolioId),
      this.dividendRepository.getAllByPortfolioId(portfolioId),
    ]);

    if (buys.length === 0) return this.emptyMetrics(targetCurrency);

    // Store the all-time first buy date before filtering
    const allTimeFirstBuy = buys.reduce((min, b) =>
      new Date(b.buy_date) < min ? new Date(b.buy_date) : min,
      new Date(buys[0].buy_date)
    );

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Apply fromDate filter if provided
    const filterFrom = fromDate ? new Date(fromDate) : null;

    const flows: CashFlow[] = [];

    for (const buy of buys) {
      const buyDate = new Date(buy.buy_date);
      if (filterFrom && buyDate < filterFrom) continue;
      const amount = this.buyAmount(buy);
      if (amount == null) continue;
      const rate = await this.getRate(buy.buy_currency_uuid, currencyId, buyDate);
      flows.push({ date: buyDate, amount: amount * rate, type: "buy", company: buy.company_name ?? undefined });
    }

    for (const sell of sells) {
      const sellDate = new Date(sell.sell_date);
      if (filterFrom && sellDate < filterFrom) continue;
      const amount = this.sellAmount(sell);
      if (amount == null) continue;
      const rate = await this.getRate(sell.sell_currency_uuid, currencyId, sellDate);
      flows.push({ date: sellDate, amount: amount * rate, type: "sell", company: sell.company_name ?? undefined });
    }

    for (const div of dividends) {
      const exDate = new Date(div.cashflow_date);
      if (exDate > today) continue;
      if (filterFrom && exDate < filterFrom) continue;
      const rate = await this.getRate(div.currency_uuid, currencyId, exDate);
      flows.push({ date: exDate, amount: div.cashflow_amount * rate, type: "dividend" });
    }

    flows.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (flows.length === 0) return this.emptyMetrics(targetCurrency);

    // ── Core totals ────────────────────────────────────────────────────────
    const totalInvested  = flows.filter(f => f.type === "buy").reduce((s, f) => s + f.amount, 0);
    const totalSells     = flows.filter(f => f.type === "sell").reduce((s, f) => s + f.amount, 0);
    const totalDividends = flows.filter(f => f.type === "dividend").reduce((s, f) => s + f.amount, 0);
    const totalReturned  = totalSells + totalDividends;
    const gain           = totalReturned - totalInvested;
    const gainPercent    = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

    // ── Time ───────────────────────────────────────────────────────────────
    // Period start = fromDate if filtered, else the actual first buy
    const firstBuy  = flows.find(f => f.type === "buy")!;
    const periodStart = filterFrom ?? (firstBuy?.date ?? allTimeFirstBuy);
    const periodYears = (today.getTime() - periodStart.getTime()) / (365.25 * 24 * 3600 * 1000);

    // ── CAGR ──────────────────────────────────────────────────────────────
    const cagr = periodYears > 0.01
      ? (Math.pow(Math.max(1 + gainPercent / 100, 1e-10), 1 / periodYears) - 1) * 100
      : gainPercent;

    // ── Monthly series ────────────────────────────────────────────────────
    const monthlyReturns = this.buildMonthlyReturns(flows, today);

    // ── TWR — computed first so twrAnnualized can be used in Sharpe/Sortino
    const { twr, twrAnnualized, logTwr } = this.computeTWR(monthlyReturns, periodYears);

    // ── Volatility (annualized std dev of monthly returns) ─────────────────
    const volatility = this.annualizedStdDev(monthlyReturns);

    // ── Sharpe — uses twrAnnualized (not gainPercent-based CAGR) so that
    //    numerator and denominator are derived from the same return series ──
    const sharpeRatio = volatility > 0.01
      ? (twrAnnualized / 100 - RISK_FREE_RATE) / (volatility / 100)
      : 0;

    // ── Sortino — same fix: use twrAnnualized in numerator ─────────────────
    const sortinoRatio = this.computeSortino(monthlyReturns, twrAnnualized);

    // ── XIRR ──────────────────────────────────────────────────────────────
    const xirr = this.computeXIRR(flows);

    // ── Dividend yield ─────────────────────────────────────────────────────
    const dividendYield = totalInvested > 0 ? (totalDividends / totalInvested) * 100 : 0;

    // ── Top holdings ───────────────────────────────────────────────────────
    const topHoldings = this.computeTopHoldings(flows, totalInvested);

    // ── Monthly data for chart ─────────────────────────────────────────────
    const monthlyData = this.computeMonthlyData(flows, today);

    // ── Drawdown ───────────────────────────────────────────────────────────
    const { maxDrawdown, maxDrawdownDurationMonths } = this.computeDrawdown(monthlyData);

    // ── Monthly TWR series (for comparison chart) ─────────────────────────
    const monthlyTwr = this.buildMonthlyTwrSeries(flows, today);

    // ── Mark-to-market metrics (unrealized gains included) ─────────────────
    // Only computed when portfolioMarketValue is provided (all-time view, no filter)
    const mtmValue       = portfolioMarketValue ?? 0;
    const totalReturnedMtm = totalReturned + mtmValue;
    const gainMtm          = totalReturnedMtm - totalInvested;
    const gainPercentMtm   = totalInvested > 0 ? (gainMtm / totalInvested) * 100 : 0;
    const cagrMtm          = periodYears > 0.01
      ? (Math.pow(Math.max(1 + gainPercentMtm / 100, 1e-10), 1 / periodYears) - 1) * 100
      : gainPercentMtm;

    // XIRR MTM: add a virtual sell of the market value at today's date
    const xirrMtm = mtmValue > 0
      ? this.computeXIRR([...flows, { date: today, amount: mtmValue, type: "sell" }])
      : xirr;

    return {
      totalInvested:   this.round(totalInvested),
      totalReturned:   this.round(totalReturned),
      gain:            this.round(gain),
      gainPercent:     this.round(gainPercent),
      portfolioMarketValue: this.round(mtmValue),
      gainMtm:         this.round(gainMtm),
      gainPercentMtm:  this.round(gainPercentMtm),
      cagrMtm:         this.round(cagrMtm),
      xirrMtm:         this.round(xirrMtm),
      cagr:            this.round(cagr),
      volatility:      this.round(volatility),
      sharpeRatio:     this.round(sharpeRatio),
      sortinoRatio:    this.round(sortinoRatio),
      twr:             this.round(twr),
      twrAnnualized:   this.round(twrAnnualized),
      logTwr:          this.round(logTwr),
      xirr:            this.round(xirr),
      maxDrawdown,
      maxDrawdownDurationMonths,
      totalDividends:  this.round(totalDividends),
      dividendYield:   this.round(dividendYield),
      firstBuyDate:    periodStart.toISOString().split("T")[0],
      periodYears:     Math.round(periodYears * 10) / 10,
      topHoldings,
      monthlyData,
      monthlyTwr,
      currencyId:      targetCurrency.uuid,
      currencyName:    targetCurrency.currency_name,
    };
  }

  // ─── Monthly return series ────────────────────────────────────────────────

  /**
   * Returns an array of monthly fractional returns:
   *   R_m = (net_inflows_this_month - net_buys_this_month) / cumulative_invested_start_of_month
   */
  private buildMonthlyReturns(flows: CashFlow[], today: Date): number[] {
    const monthlyBuys    = new Map<string, number>();
    const monthlyInflows = new Map<string, number>();

    for (const f of flows) {
      const key = this.monthKey(f.date);
      if (f.type === "buy") {
        monthlyBuys.set(key, (monthlyBuys.get(key) ?? 0) + f.amount);
      } else {
        monthlyInflows.set(key, (monthlyInflows.get(key) ?? 0) + f.amount);
      }
    }

    const returns: number[] = [];
    let cumInvested = 0;
    let current = this.parseMonthKey(this.monthKey(flows[0].date));
    const end   = this.parseMonthKey(this.monthKey(today));

    while (current <= end) {
      const key     = this.monthKey(current);
      const buys    = monthlyBuys.get(key)    ?? 0;
      const inflows = monthlyInflows.get(key) ?? 0;

      if (cumInvested > 0) {
        returns.push((inflows - buys) / cumInvested);
      }

      cumInvested += buys;
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return returns;
  }

  /**
   * Returns cumulative chain-linked TWR per month, starting at 0% on the first buy month.
   * Used by the Comparisons page to draw a normalized performance chart.
   */
  private buildMonthlyTwrSeries(flows: CashFlow[], today: Date): MonthlyTwrPoint[] {
    const monthlyBuys    = new Map<string, number>();
    const monthlyInflows = new Map<string, number>();

    for (const f of flows) {
      const key = this.monthKey(f.date);
      if (f.type === "buy") {
        monthlyBuys.set(key, (monthlyBuys.get(key) ?? 0) + f.amount);
      } else {
        monthlyInflows.set(key, (monthlyInflows.get(key) ?? 0) + f.amount);
      }
    }

    const series: MonthlyTwrPoint[] = [];
    let cumInvested = 0;
    let twrFactor   = 1;
    let current = this.parseMonthKey(this.monthKey(flows[0].date));
    const end   = this.parseMonthKey(this.monthKey(today));

    while (current <= end) {
      const key     = this.monthKey(current);
      const buys    = monthlyBuys.get(key)    ?? 0;
      const inflows = monthlyInflows.get(key) ?? 0;

      if (cumInvested > 0) {
        const r = (inflows - buys) / cumInvested;
        twrFactor *= (1 + r);
      }

      cumInvested += buys;
      series.push({ month: key, cumTwr: this.round((twrFactor - 1) * 100) });
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return series;
  }

  // ─── Volatility ───────────────────────────────────────────────────────────

  private annualizedStdDev(monthlyReturns: number[]): number {
    if (monthlyReturns.length < 2) return 0;
    const mean     = monthlyReturns.reduce((s, v) => s + v, 0) / monthlyReturns.length;
    const variance = monthlyReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (monthlyReturns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(12) * 100;
  }

  // ─── Sortino ratio ────────────────────────────────────────────────────────

  private computeSortino(monthlyReturns: number[], cagrPct: number): number {
    if (monthlyReturns.length < 2) return 0;

    const monthlyRfr = RISK_FREE_RATE / 12;
    // Downside deviation: semi-deviation of returns below risk-free (annualized)
    const squaredDownside = monthlyReturns
      .map(r => Math.min(r - monthlyRfr, 0) ** 2)
      .reduce((s, v) => s + v, 0);

    const downsideDev = Math.sqrt(squaredDownside / monthlyReturns.length) * Math.sqrt(12);
    if (downsideDev < 0.0001) return cagrPct > 0 ? 3 : 0; // no downside → very high ratio

    return (cagrPct / 100 - RISK_FREE_RATE) / downsideDev;
  }

  // ─── TWR ─────────────────────────────────────────────────────────────────

  private computeTWR(monthlyReturns: number[], periodYears: number): { twr: number; twrAnnualized: number; logTwr: number } {
    if (monthlyReturns.length === 0) return { twr: 0, twrAnnualized: 0, logTwr: 0 };

    // Chain-linked: TWR_factor = Π(1 + R_m)
    const twrFactor = monthlyReturns.reduce((prod, r) => prod * (1 + r), 1);
    const twr       = (twrFactor - 1) * 100;

    const twrAnnualized = periodYears > 0.01
      ? (Math.pow(Math.max(twrFactor, 1e-10), 1 / periodYears) - 1) * 100
      : twr;

    // Continuous (log) return: ln(TWR_factor)
    const logTwr = twrFactor > 0 ? Math.log(twrFactor) * 100 : 0;

    return { twr, twrAnnualized, logTwr };
  }

  // ─── XIRR ─────────────────────────────────────────────────────────────────

  private computeXIRR(flows: CashFlow[]): number {
    if (flows.length < 2) return 0;

    const firstDate = flows[0].date.getTime();
    // Build (days, amount) pairs: outflows are negative, inflows positive
    const cf = flows.map(f => ({
      days:   (f.date.getTime() - firstDate) / 86_400_000,
      amount: f.type === "buy" ? -f.amount : f.amount,
    }));

    const npv  = (r: number) => cf.reduce((s, { days, amount }) => s + amount / Math.pow(1 + r, days / 365), 0);
    const dnpv = (r: number) => cf.reduce((s, { days, amount }) => s - (days / 365) * amount / Math.pow(1 + r, days / 365 + 1), 0);

    // Newton-Raphson starting from 10 %
    let r = 0.10;
    for (let i = 0; i < 100; i++) {
      const f  = npv(r);
      const df = dnpv(r);
      if (Math.abs(df) < 1e-12) break;
      const rNew = r - f / df;
      if (!isFinite(rNew)) break;
      if (Math.abs(rNew - r) < 1e-8) { r = rNew; break; }
      r = Math.max(rNew, -0.999); // prevent divergence
    }

    return isFinite(r) ? r * 100 : 0;
  }

  // ─── Drawdown ────────────────────────────────────────────────────────────

  /**
   * Computes max peak-to-trough drawdown on the realized-value curve
   * (invested + netGain) and its duration in months.
   */
  private computeDrawdown(monthlyData: MonthlyDataPoint[]): {
    maxDrawdown: number;
    maxDrawdownDurationMonths: number;
  } {
    if (monthlyData.length < 2) return { maxDrawdown: 0, maxDrawdownDurationMonths: 0 };

    let peak            = -Infinity;
    let maxDD           = 0;
    let ddStartIdx      = -1;
    let maxDDDuration   = 0;

    for (let i = 0; i < monthlyData.length; i++) {
      const val = monthlyData[i].invested + monthlyData[i].netGain;

      if (val >= peak) {
        peak       = val;
        ddStartIdx = i; // potential drawdown starts here
      } else {
        const dd = peak > 0 ? (peak - val) / peak : 0;
        if (dd > maxDD) {
          maxDD         = dd;
          maxDDDuration = i - ddStartIdx;
        }
      }
    }

    return {
      maxDrawdown:              this.round(maxDD * 100),
      maxDrawdownDurationMonths: maxDDDuration,
    };
  }

  // ─── Monthly data for chart ───────────────────────────────────────────────

  private computeMonthlyData(flows: CashFlow[], today: Date): MonthlyDataPoint[] {
    const monthlyBuys    = new Map<string, number>();
    const monthlyInflows = new Map<string, number>();

    for (const f of flows) {
      const key = this.monthKey(f.date);
      if (f.type === "buy") {
        monthlyBuys.set(key, (monthlyBuys.get(key) ?? 0) + f.amount);
      } else {
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
      cumInvested += monthlyBuys.get(key)    ?? 0;
      cumReturned += monthlyInflows.get(key) ?? 0;

      points.push({
        month:   key,
        netGain: this.round(cumReturned - cumInvested),
        invested: this.round(cumInvested),
      });

      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return points;
  }

  // ─── Top holdings ─────────────────────────────────────────────────────────

  private computeTopHoldings(flows: CashFlow[], totalInvested: number): TopHolding[] {
    const netByCompany = new Map<string, number>();

    for (const f of flows) {
      if (!f.company) continue;
      const current = netByCompany.get(f.company) ?? 0;
      if (f.type === "buy")       netByCompany.set(f.company, current + f.amount);
      else if (f.type === "sell") netByCompany.set(f.company, current - f.amount);
    }

    return Array.from(netByCompany.entries())
      .filter(([, net]) => net > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([company, invested]) => ({
        companyName: company,
        invested:    this.round(invested),
        allocation:  totalInvested > 0 ? this.round((invested / totalInvested) * 100) : 0,
      }));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

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
      const rate  = forex?.forex_rate ?? 1;
      this.rateCache.set(key, rate);
      return rate;
    } catch { return 1; }
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
      portfolioMarketValue: 0, gainMtm: 0, gainPercentMtm: 0, cagrMtm: 0, xirrMtm: 0,
      cagr: 0, volatility: 0, sharpeRatio: 0, sortinoRatio: 0,
      twr: 0, twrAnnualized: 0, logTwr: 0, xirr: 0,
      maxDrawdown: 0, maxDrawdownDurationMonths: 0,
      totalDividends: 0, dividendYield: 0,
      firstBuyDate: null, periodYears: 0,
      topHoldings: [], monthlyData: [], monthlyTwr: [],
      currencyId: currency.uuid, currencyName: currency.currency_name,
    };
  }
}
