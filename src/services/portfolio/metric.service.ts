import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { Asset, Currency } from "../../db_schema";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user.asset.buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user.asset.sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user.asset.dividend.repository";
import { AssetPriceRepository } from "../../repositories/asset/asset_price.repository";
import { AssetRepository } from "../../repositories/asset/asset.repository";
import { EtfHoldingsRepository } from "../../repositories/asset/etf_holding.repository";
import { MetricResponseDto, DashboardResponseDto, TopHolding, AllocationItem, MonthlyDataPoint, MonthlyTwrPoint } from "../../dtos/portfolio/responses/metric.response.dto";
import { CurrenciesRepository } from "../../repositories";
import { AssetType } from "../../dtos";

const RISK_FREE_RATE = 0.04; // 4 % annual

type FlowType = "buy" | "sell" | "dividend";

interface CashFlow {
  date: Date;
  amount: number;
  type: FlowType;
  company?: string;
}

export class MetricService {
  private readonly buyRepository:        UserAssetBuyRepository;
  private readonly sellRepository:       UserAssetSellRepository;
  private readonly dividendRepository:   UserAssetDividendRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly assetPriceRepository:  AssetPriceRepository;
  private readonly assetRepository:       AssetRepository;
  private readonly etfHoldingsRepository: EtfHoldingsRepository;
  // Promise-based cache: storing the Promise itself ensures concurrent calls for the same
  // (currency, date) key share a single DB round-trip instead of each firing their own query.
  private rateCache: Map<string, Promise<number>> = new Map();

  constructor() {
    this.buyRepository         = new UserAssetBuyRepository();
    this.sellRepository        = new UserAssetSellRepository();
    this.dividendRepository    = new UserAssetDividendRepository();
    this.currenciesRepository  = new CurrenciesRepository();
    this.assetPriceRepository  = new AssetPriceRepository();
    this.assetRepository       = new AssetRepository();
    this.etfHoldingsRepository = new EtfHoldingsRepository();
  }

  // ─── Public entry point — free dashboard data (chart + holdings + sectors) ─

  public async getDashboardData(portfolioId: string, currencyId: string): Promise<DashboardResponseDto> {
    this.rateCache.clear();

    const targetCurrency = await this.currenciesRepository.getById(currencyId);
    if (!targetCurrency) throw new Error("CURRENCY_NOT_FOUND");

    const empty: DashboardResponseDto = {
      monthlyData: [], topHoldings: [], sectorBreakdown: [], countryBreakdown: [],
      currencyId: targetCurrency.uuid, currencyName: targetCurrency.currency_name,
    };

    const [buys, sells, dividends] = await Promise.all([
      this.buyRepository.getAllByPortfolioId(portfolioId),
      this.sellRepository.getAllByPortfolioId(portfolioId),
      this.dividendRepository.getAllByPortfolioId(portfolioId),
    ]);

    if (buys.length === 0) return empty;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Build currency-converted flows (buy, sell, dividend) — same logic as getMetrics
    const flows: CashFlow[] = [];

    const [buyFlows, sellFlows, divFlows] = await Promise.all([
      Promise.all(buys.map(async (buy) => {
        const amount = this.buyAmount(buy);
        if (amount == null) return null;
        const rate = await this.getRate(buy.buy_currency_uuid, currencyId, new Date(buy.buy_date));
        return { date: new Date(buy.buy_date), amount: amount * rate, type: "buy" as FlowType, company: buy.company_name ?? undefined };
      })),
      Promise.all(sells.map(async (sell) => {
        const amount = this.sellAmount(sell);
        if (amount == null) return null;
        const rate = await this.getRate(sell.sell_currency_uuid, currencyId, new Date(sell.sell_date));
        return { date: new Date(sell.sell_date), amount: amount * rate, type: "sell" as FlowType, company: sell.company_name ?? undefined };
      })),
      Promise.all(dividends.map(async (div) => {
        const exDate = new Date(div.cashflow_date);
        if (exDate > today) return null;
        const rate = await this.getRate(div.currency_uuid, currencyId, exDate);
        return { date: exDate, amount: div.cashflow_amount * rate, type: "dividend" as FlowType };
      })),
    ]);

    for (const f of buyFlows)  if (f) flows.push(f);
    for (const f of sellFlows) if (f) flows.push(f);
    for (const f of divFlows)  if (f) flows.push(f);
    flows.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (flows.length === 0) return empty;

    // Compute chart data + holdings breakdown in parallel (no TWR/Sharpe/XIRR)
    const totalInvested = flows.filter(f => f.type === "buy").reduce((s, f) => s + f.amount, 0);

    const [monthlyData, { topHoldings: topHoldingsMv, sectorBreakdown, countryBreakdown }] = await Promise.all([
      this.computeMonthlyData(flows, buys, sells, currencyId, today),
      this.computeHoldingsBreakdown(buys, sells, currencyId),
    ]);

    const topHoldings = topHoldingsMv.length > 0
      ? topHoldingsMv
      : this.computeTopHoldings(flows, totalInvested);

    return { monthlyData, topHoldings, sectorBreakdown, countryBreakdown, currencyId: targetCurrency.uuid, currencyName: targetCurrency.currency_name };
  }

  // ─── Public entry point — full metrics (Pro) ───────────────────────────────

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

    const filterFrom = fromDate ? new Date(fromDate) : null;

    const flows: CashFlow[] = [];

    // ── Buys, sells, dividends — all parallel ─────────────────────────────
    // Promise-based rateCache guarantees each unique (currency, date) pair hits
    // the DB exactly once even with many concurrent callers.
    const [buyFlows, sellResults, divFlows] = await Promise.all([
      Promise.all(buys.map(async (buy) => {
        const buyDate = new Date(buy.buy_date);
        if (filterFrom && buyDate < filterFrom) return null;
        const amount = this.buyAmount(buy);
        if (amount == null) return null;
        const rate = await this.getRate(buy.buy_currency_uuid, currencyId, buyDate);
        return { date: buyDate, amount: amount * rate, type: "buy" as FlowType, company: buy.company_name ?? undefined };
      })),
      Promise.all(sells.map(async (sell) => {
        const sellDate = new Date(sell.sell_date);
        if (filterFrom && sellDate < filterFrom) return null;
        const amount = this.sellAmount(sell);
        if (amount == null) return null;
        const rate = await this.getRate(sell.sell_currency_uuid, currencyId, sellDate);
        const costBasis = sell.asset_sell_share != null && sell.average_asset_share_buy_price != null
          ? sell.asset_sell_share * sell.average_asset_share_buy_price * rate
          : 0;
        return {
          flow: { date: sellDate, amount: amount * rate, type: "sell" as FlowType, company: sell.company_name ?? undefined },
          costBasis,
        };
      })),
      Promise.all(dividends.map(async (div) => {
        const exDate = new Date(div.cashflow_date);
        if (exDate > today) return null;
        if (filterFrom && exDate < filterFrom) return null;
        const rate = await this.getRate(div.currency_uuid, currencyId, exDate);
        return { date: exDate, amount: div.cashflow_amount * rate, type: "dividend" as FlowType };
      })),
    ]);

    for (const f of buyFlows) if (f) flows.push(f);

    // ── Sell loop — also track cost basis of each sell for Realized P&L ────
    let costBasisOfSells = 0;
    for (const r of sellResults) {
      if (!r) continue;
      flows.push(r.flow);
      costBasisOfSells += r.costBasis;
    }

    for (const f of divFlows) if (f) flows.push(f);

    flows.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (flows.length === 0) return this.emptyMetrics(targetCurrency);

    // ── Core totals ────────────────────────────────────────────────────────
    const totalInvested  = flows.filter(f => f.type === "buy").reduce((s, f) => s + f.amount, 0);
    const totalSells     = flows.filter(f => f.type === "sell").reduce((s, f) => s + f.amount, 0);
    const totalDividends = flows.filter(f => f.type === "dividend").reduce((s, f) => s + f.amount, 0);
    const totalReturned  = totalSells + totalDividends;

    // ── Realized P&L (FIX #1) ──────────────────────────────────────────────
    // Correct formula: (proceeds from sells - cost of those shares) + dividends
    // Does NOT subtract open-position capital → no more artificial -66%
    const gain = costBasisOfSells > 0
      ? (totalSells - costBasisOfSells) + totalDividends
      : totalReturned - totalInvested; // fallback when avg_buy_price unavailable

    // Express as % of total invested so it's comparable across periods
    const gainPercent = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

    // ── Time ───────────────────────────────────────────────────────────────
    const firstBuy    = flows.find(f => f.type === "buy")!;
    const periodStart = filterFrom ?? (firstBuy?.date ?? allTimeFirstBuy);
    const periodYears = (today.getTime() - periodStart.getTime()) / (365.25 * 24 * 3600 * 1000);

    // ── CAGR (realized) ────────────────────────────────────────────────────
    const cagr = periodYears > 0.01
      ? (Math.pow(Math.max(1 + gainPercent / 100, 1e-10), 1 / periodYears) - 1) * 100
      : gainPercent;

    // ── Monthly chart data ─────────────────────────────────────────────────
    // Computed FIRST so real market values are available for TWR (FIX #2)
    const monthlyData = await this.computeMonthlyData(flows, buys, sells, currencyId, today);

    // ── Beginning-of-period market value for filtered TWR (FIX #2 cont.) ──
    // For a "2Y" view, we need the portfolio value at the START of that period
    // (including positions bought before the filter date) so Modified Dietz
    // doesn't start from 0 and produce nonsense on the first month.
    let beginningPeriodMV = 0;
    if (filterFrom) {
      const prevMonth = new Date(filterFrom);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const prevMonthKey = this.monthKey(prevMonth);
      const prevMVMap = await this.computeHistoricalMarketValues(buys, sells, [prevMonthKey], currencyId);
      beginningPeriodMV = prevMVMap.get(prevMonthKey) ?? 0;
    }

    // ── Modified Dietz monthly returns (FIX #2) ───────────────────────────
    // R_m = (EV_m - BV_m - CF_m) / (BV_m + CF_m/2)
    // CF_m = buys(+) - sells(-) - dividends(-) for month m
    const monthlyReturns = this.buildMonthlyReturnsMV(monthlyData, flows, beginningPeriodMV);

    // ── TWR ────────────────────────────────────────────────────────────────
    const { twr, twrAnnualized, logTwr } = this.computeTWR(monthlyReturns, periodYears);

    // ── Volatility ─────────────────────────────────────────────────────────
    const volatility = this.annualizedStdDev(monthlyReturns);

    // ── Sharpe ─────────────────────────────────────────────────────────────
    const sharpeRatio = volatility > 0.01
      ? (twrAnnualized / 100 - RISK_FREE_RATE) / (volatility / 100)
      : 0;

    // ── Sortino ────────────────────────────────────────────────────────────
    const sortinoRatio = this.computeSortino(monthlyReturns, twrAnnualized);

    // ── XIRR (FIX #3) ─────────────────────────────────────────────────────
    const xirr = this.computeXIRR(flows);

    // ── Dividend yield ─────────────────────────────────────────────────────
    const dividendYield = totalInvested > 0 ? (totalDividends / totalInvested) * 100 : 0;

    // ── Holdings breakdown ─────────────────────────────────────────────────
    const { topHoldings: topHoldingsMv, sectorBreakdown, countryBreakdown } =
      await this.computeHoldingsBreakdown(buys, sells, currencyId);
    const topHoldings = topHoldingsMv.length > 0 ? topHoldingsMv : this.computeTopHoldings(flows, totalInvested);

    // ── Drawdown (FIX #4) — from real market values, not cash flows ────────
    const { maxDrawdown, maxDrawdownDurationMonths } = this.computeDrawdown(monthlyData);

    // ── Monthly TWR series (for comparison chart) ─────────────────────────
    const monthlyTwr = this.buildMonthlyTwrSeries(monthlyData, flows, beginningPeriodMV);

    // ── Mark-to-market metrics ─────────────────────────────────────────────
    // Fallback: if portfolioMarketValue wasn't provided for the all-time view
    // (e.g. getPortfolioTotal threw silently in the controller), derive it from
    // the most recent monthly market value we already computed.
    // We only do this for the all-time view (no filterFrom) — for period views
    // the controller intentionally omits it to avoid mixing pre-period positions
    // into a period-scoped XIRR calculation.
    let mtmValue = portfolioMarketValue ?? 0;
    if (mtmValue === 0 && !filterFrom && monthlyData.length > 0) {
      const lastWithMV = [...monthlyData].reverse().find(p => p.marketValue > 0);
      if (lastWithMV) mtmValue = lastWithMV.marketValue;
    }
    const totalReturnedMtm = totalReturned + mtmValue;
    const gainMtm          = totalReturnedMtm - totalInvested;
    const gainPercentMtm   = totalInvested > 0 ? (gainMtm / totalInvested) * 100 : 0;
    const cagrMtm          = periodYears > 0.01
      ? (Math.pow(Math.max(1 + gainPercentMtm / 100, 1e-10), 1 / periodYears) - 1) * 100
      : gainPercentMtm;

    // XIRR MTM: add a virtual sell of the current market value at today's date
    const xirrMtm = mtmValue > 0
      ? this.computeXIRR([...flows, { date: today, amount: mtmValue, type: "sell" }])
      : xirr;

    return {
      totalInvested:        this.round(totalInvested),
      totalReturned:        this.round(totalReturned),
      gain:                 this.round(gain),
      gainPercent:          this.round(gainPercent),
      portfolioMarketValue: this.round(mtmValue),
      gainMtm:              this.round(gainMtm),
      gainPercentMtm:       this.round(gainPercentMtm),
      cagrMtm:              this.round(cagrMtm),
      xirrMtm:              this.round(xirrMtm),
      cagr:                 this.round(cagr),
      volatility:           this.round(volatility),
      sharpeRatio:          this.round(sharpeRatio),
      sortinoRatio:         this.round(sortinoRatio),
      twr:                  this.round(twr),
      twrAnnualized:        this.round(twrAnnualized),
      logTwr:               this.round(logTwr),
      xirr:                 this.round(xirr),
      maxDrawdown,
      maxDrawdownDurationMonths,
      totalDividends:       this.round(totalDividends),
      dividendYield:        this.round(dividendYield),
      firstBuyDate:         periodStart.toISOString().split("T")[0],
      periodYears:          Math.round(periodYears * 10) / 10,
      topHoldings,
      sectorBreakdown,
      countryBreakdown,
      monthlyData,
      monthlyTwr,
      currencyId:           targetCurrency.uuid,
      currencyName:         targetCurrency.currency_name,
    };
  }

  // ─── Modified Dietz monthly returns (FIX #2) ──────────────────────────────

  /**
   * Computes monthly sub-period returns using the Modified Dietz method.
   *
   *   R_m = (EV_m − BV_m − CF_m) / (BV_m + CF_m / 2)
   *
   * Where:
   *   EV_m  = end-of-month market value (from historical price data)
   *   BV_m  = beginning-of-month MV (= previous month's EV, or initialMV for first month)
   *   CF_m  = net external cash flow: buys add (+), sells and dividends leave (−)
   *
   * This correctly isolates price performance from cash injections / withdrawals.
   * Previous formula treated every buy as a negative return for that month.
   */
  private buildMonthlyReturnsMV(
    monthlyData:  MonthlyDataPoint[],
    flows:        CashFlow[],
    initialMV:    number = 0,
  ): number[] {
    // Net CF per month: buys add money to portfolio, sells/dividends remove it
    const monthlyCF = new Map<string, number>();
    for (const f of flows) {
      const key   = this.monthKey(f.date);
      const delta = f.type === "buy" ? f.amount : -f.amount;
      monthlyCF.set(key, (monthlyCF.get(key) ?? 0) + delta);
    }

    const returns: number[] = [];
    let prevMV = initialMV;

    for (const point of monthlyData) {
      const cf = monthlyCF.get(point.month) ?? 0;
      // Use real price-based market value; fall back to cost basis when prices absent
      const endMV = point.marketValue > 0 ? point.marketValue : point.netCostBasis;

      if (prevMV > 0.01) {
        const denom = prevMV + cf / 2;
        if (Math.abs(denom) > 0.01) {
          const r = (endMV - prevMV - cf) / denom;
          // Sanity clamp: a single month should never show < -100% or > +500%
          if (r >= -0.99 && r <= 5.0) {
            returns.push(r);
          }
        }
      }
      // When prevMV = 0, skip — no starting value to measure performance against

      if (endMV > 0) prevMV = endMV;
    }

    return returns;
  }

  // ─── Monthly TWR series (for Comparisons chart) ───────────────────────────

  /**
   * Cumulative chain-linked TWR per month using Modified Dietz sub-period returns.
   * Starts at 0% on the first month where we have a beginning market value.
   */
  private buildMonthlyTwrSeries(
    monthlyData:  MonthlyDataPoint[],
    flows:        CashFlow[],
    initialMV:    number = 0,
  ): MonthlyTwrPoint[] {
    const monthlyCF = new Map<string, number>();
    for (const f of flows) {
      const key   = this.monthKey(f.date);
      const delta = f.type === "buy" ? f.amount : -f.amount;
      monthlyCF.set(key, (monthlyCF.get(key) ?? 0) + delta);
    }

    const series: MonthlyTwrPoint[] = [];
    let prevMV    = initialMV;
    let twrFactor = 1;

    for (const point of monthlyData) {
      const cf    = monthlyCF.get(point.month) ?? 0;
      const endMV = point.marketValue > 0 ? point.marketValue : point.netCostBasis;

      if (prevMV > 0.01) {
        const denom = prevMV + cf / 2;
        if (Math.abs(denom) > 0.01) {
          const r = (endMV - prevMV - cf) / denom;
          if (r >= -0.99 && r <= 5.0) {
            twrFactor *= (1 + r);
          }
        }
      }

      series.push({ month: point.month, cumTwr: this.round((twrFactor - 1) * 100) });
      if (endMV > 0) prevMV = endMV;
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
    const squaredDownside = monthlyReturns
      .map(r => Math.min(r - monthlyRfr, 0) ** 2)
      .reduce((s, v) => s + v, 0);

    const downsideDev = Math.sqrt(squaredDownside / monthlyReturns.length) * Math.sqrt(12);
    if (downsideDev < 0.0001) return cagrPct > 0 ? 3 : 0;

    return (cagrPct / 100 - RISK_FREE_RATE) / downsideDev;
  }

  // ─── TWR ─────────────────────────────────────────────────────────────────

  private computeTWR(monthlyReturns: number[], periodYears: number): { twr: number; twrAnnualized: number; logTwr: number } {
    if (monthlyReturns.length === 0) return { twr: 0, twrAnnualized: 0, logTwr: 0 };

    const twrFactor = monthlyReturns.reduce((prod, r) => prod * (1 + r), 1);
    const twr       = (twrFactor - 1) * 100;

    const twrAnnualized = periodYears > 0.01
      ? (Math.pow(Math.max(twrFactor, 1e-10), 1 / periodYears) - 1) * 100
      : twr;

    const logTwr = twrFactor > 0 ? Math.log(twrFactor) * 100 : 0;

    return { twr, twrAnnualized, logTwr };
  }

  // ─── XIRR (FIX #3) ────────────────────────────────────────────────────────

  /**
   * Newton-Raphson XIRR with:
   *   • Upper clamp at r = 100 (10 000%) to prevent divergence to +∞
   *   • Lower clamp at r = -0.999 (original)
   *   • Convergence check: final NPV must be < 1% of largest cash flow
   */
  private computeXIRR(flows: CashFlow[]): number {
    if (flows.length < 2) return 0;

    const firstDate = flows[0].date.getTime();
    const cf = flows.map(f => ({
      days:   (f.date.getTime() - firstDate) / 86_400_000,
      amount: f.type === "buy" ? -f.amount : f.amount,
    }));

    const npv  = (r: number) => cf.reduce((s, { days, amount }) => s + amount / Math.pow(1 + r, days / 365), 0);
    const dnpv = (r: number) => cf.reduce((s, { days, amount }) => s - (days / 365) * amount / Math.pow(1 + r, days / 365 + 1), 0);

    let r = 0.10;
    for (let i = 0; i < 100; i++) {
      const fv  = npv(r);
      const dfv = dnpv(r);
      if (Math.abs(dfv) < 1e-12) break;
      const rNew = r - fv / dfv;
      if (!isFinite(rNew) || isNaN(rNew)) break;
      if (Math.abs(rNew - r) < 1e-8) { r = rNew; break; }
      // Clamp both bounds to prevent divergence
      r = Math.max(Math.min(rNew, 100.0), -0.999);
    }

    // Verify convergence: NPV at solution must be close to zero
    const cashScale = Math.max(...cf.map(c => Math.abs(c.amount)));
    const finalNpv  = npv(r);
    if (!isFinite(r) || Math.abs(finalNpv) > cashScale * 0.01) return 0;

    return r * 100;
  }

  // ─── Drawdown (FIX #4) ───────────────────────────────────────────────────

  /**
   * Max peak-to-trough drawdown measured on the portfolio's MARKET VALUE.
   *
   * Previous version used `invested + netGain = cumReturned` which is monotonically
   * increasing (dividends + sell proceeds only grow) → always 0% drawdown.
   * Now uses `monthlyData[i].marketValue` (real price-based value).
   */
  private computeDrawdown(monthlyData: MonthlyDataPoint[]): {
    maxDrawdown: number;
    maxDrawdownDurationMonths: number;
  } {
    if (monthlyData.length < 2) return { maxDrawdown: 0, maxDrawdownDurationMonths: 0 };

    let peak          = -Infinity;
    let maxDD         = 0;
    let ddStartIdx    = -1;
    let maxDDDuration = 0;

    for (let i = 0; i < monthlyData.length; i++) {
      // Use real market value; fall back to cost basis of remaining positions
      const val = monthlyData[i].marketValue > 0
        ? monthlyData[i].marketValue
        : monthlyData[i].netCostBasis;

      if (val <= 0) continue; // skip months without valid data (no prices yet)

      if (val >= peak) {
        peak       = val;
        ddStartIdx = i;
      } else {
        const dd = (peak - val) / peak;
        if (dd > maxDD) {
          maxDD         = dd;
          maxDDDuration = i - ddStartIdx;
        }
      }
    }

    return {
      maxDrawdown:               this.round(maxDD * 100),
      maxDrawdownDurationMonths: maxDDDuration,
    };
  }

  // ─── Monthly data for chart ───────────────────────────────────────────────

  private async computeMonthlyData(
    flows: CashFlow[],
    buys: UserAssetBuy[],
    sells: UserAssetSell[],
    currencyId: string,
    today: Date
  ): Promise<MonthlyDataPoint[]> {
    const monthlyBuys    = new Map<string, number>();
    const monthlyInflows = new Map<string, number>();
    const monthlySells   = new Map<string, number>();

    for (const f of flows) {
      const key = this.monthKey(f.date);
      if (f.type === "buy") {
        monthlyBuys.set(key, (monthlyBuys.get(key) ?? 0) + f.amount);
      } else {
        monthlyInflows.set(key, (monthlyInflows.get(key) ?? 0) + f.amount);
      }
      if (f.type === "sell") {
        monthlySells.set(key, (monthlySells.get(key) ?? 0) + f.amount);
      }
    }

    const monthKeys: string[] = [];
    const start = this.parseMonthKey(this.monthKey(flows[0].date));
    const end   = this.parseMonthKey(this.monthKey(today));
    const temp  = new Date(start);
    while (temp <= end) {
      monthKeys.push(this.monthKey(temp));
      temp.setMonth(temp.getMonth() + 1);
    }

    const marketValues = await this.computeHistoricalMarketValues(buys, sells, monthKeys, currencyId);

    const points: MonthlyDataPoint[] = [];
    let cumInvested = 0;
    let cumReturned = 0;
    let cumSells    = 0;
    let current = new Date(start);

    while (current <= end) {
      const key = this.monthKey(current);
      cumInvested += monthlyBuys.get(key)    ?? 0;
      cumReturned += monthlyInflows.get(key) ?? 0;
      cumSells    += monthlySells.get(key)   ?? 0;

      points.push({
        month:        key,
        netGain:      this.round(cumReturned - cumInvested),
        invested:     this.round(cumInvested),
        netCostBasis: this.round(Math.max(0, cumInvested - cumSells)),
        marketValue:  this.round(marketValues.get(key) ?? 0),
      });

      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return points;
  }

  // ─── Historical market value computation ──────────────────────────────────

  private async computeHistoricalMarketValues(
    buys: UserAssetBuy[],
    sells: UserAssetSell[],
    monthKeys: string[],
    currencyId: string
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    interface AssetTracker {
      baseCurrencyUuid: string;
      buys:   Array<{ date: Date; shares: number }>;
      sells:  Array<{ date: Date; shares: number }>;
      prices: Array<{ date: Date; price: number }>;
    }

    const trackerMap = new Map<string, AssetTracker>();
    // Promise-based cache prevents duplicate DB lookups for the same asset under parallel calls
    const assetCache = new Map<string, Promise<Asset | null>>();

    const resolveAsset = (assetUuid: string | null, companyName: string | null): Promise<Asset | null> => {
      const cacheKey = assetUuid ?? `name:${companyName}`;
      if (!assetCache.has(cacheKey)) {
        assetCache.set(cacheKey, (async (): Promise<Asset | null> => {
          if (assetUuid) return this.assetRepository.getAssetFromUUID(assetUuid);
          if (companyName) {
            return (await this.assetRepository.getAssetFromOfficialName(companyName))
              ?? this.assetRepository.getAssetFromTicker(companyName);
          }
          return null;
        })());
      }
      return assetCache.get(cacheKey)!;
    };

    // ── Pre-warm asset cache in parallel ────────────────────────────────────
    // All unique assets are resolved concurrently; the loops below are instant cache hits.
    await Promise.all([
      ...buys.filter(b => b.asset_buy_share).map(b => resolveAsset(b.asset_uuid, b.company_name)),
      ...sells.filter(s => s.asset_sell_share).map(s => resolveAsset(s.asset_uuid, s.company_name)),
    ]);

    // ── Build tracker map (all cache hits now — no DB calls) ────────────────
    for (const buy of buys) {
      if (!buy.asset_buy_share) continue;
      const asset = await resolveAsset(buy.asset_uuid, buy.company_name);
      if (!asset?.uuid || !asset?.base_currency_uuid) continue;

      if (!trackerMap.has(asset.uuid)) {
        trackerMap.set(asset.uuid, { baseCurrencyUuid: asset.base_currency_uuid, buys: [], sells: [], prices: [] });
      }
      trackerMap.get(asset.uuid)!.buys.push({ date: new Date(buy.buy_date), shares: buy.asset_buy_share });
    }

    for (const sell of sells) {
      if (!sell.asset_sell_share) continue;
      const asset = await resolveAsset(sell.asset_uuid, sell.company_name);
      if (!asset?.uuid || !trackerMap.has(asset.uuid)) continue;

      trackerMap.get(asset.uuid)!.sells.push({ date: new Date(sell.sell_date), shares: sell.asset_sell_share });
    }

    // ── Fetch all asset price histories in parallel ─────────────────────────
    // Previously sequential (1 query per asset); now all fire concurrently.
    await Promise.all(
      Array.from(trackerMap.entries()).map(async ([uuid, tracker]) => {
        const allPrices = await this.assetPriceRepository.getAllPricesForAsset(uuid);
        tracker.prices = allPrices.map(p => ({ date: new Date(p.asset_price_date), price: p.asset_price }));
      })
    );

    // ── Compute market values for ALL months in parallel ────────────────────
    // Previously: M months × N assets = M×N sequential getRate calls.
    // Now: all months processed concurrently; getRate cache prevents duplicate DB queries
    // for the same (currency, month-end-date) across assets.
    const monthResults = await Promise.all(
      monthKeys.map(async (monthKey) => {
        const [year, month] = monthKey.split("-").map(Number);
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));

        const assetValues = await Promise.all(
          Array.from(trackerMap.values()).map(async (tracker) => {
            const sharesHeld =
              tracker.buys.filter(b => b.date <= endOfMonth).reduce((s, b) => s + b.shares, 0) -
              tracker.sells.filter(sl => sl.date <= endOfMonth).reduce((s, sl) => s + sl.shares, 0);
            if (sharesHeld <= 0.0001) return 0;
            const price = this.findPriceAtOrBefore(tracker.prices, endOfMonth);
            if (price === null) return 0;
            const rate = await this.getRate(tracker.baseCurrencyUuid, currencyId, endOfMonth);
            return sharesHeld * price * rate;
          })
        );

        return { monthKey, total: assetValues.reduce((sum, v) => sum + v, 0) };
      })
    );

    for (const { monthKey, total } of monthResults) {
      result.set(monthKey, total);
    }

    return result;
  }

  private findPriceAtOrBefore(prices: Array<{ date: Date; price: number }>, targetDate: Date): number | null {
    let result: number | null = null;
    for (const p of prices) {
      if (p.date <= targetDate) result = p.price;
      else break;
    }
    return result;
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

  private async computeHoldingsBreakdown(
    buys: UserAssetBuy[],
    sells: UserAssetSell[],
    currencyId: string
  ): Promise<{ topHoldings: TopHolding[]; sectorBreakdown: AllocationItem[]; countryBreakdown: AllocationItem[] }> {
    const empty = { topHoldings: [], sectorBreakdown: [], countryBreakdown: [] };

    interface Holding {
      companyName:      string;
      sectorName:       string | null;
      countryName:      string | null;
      baseCurrencyUuid: string;
      shares:           number;
      marketValue:      number;
      isEtf:            boolean;
    }

    const holdingMap = new Map<string, Holding>();
    // Promise-based cache prevents duplicate DB lookups for the same asset under parallel calls
    const assetCache = new Map<string, Promise<Asset | null>>();

    const resolveAsset = (assetUuid: string | null, companyName: string | null): Promise<Asset | null> => {
      const key = assetUuid ?? `name:${companyName}`;
      if (!assetCache.has(key)) {
        assetCache.set(key, (async (): Promise<Asset | null> => {
          if (assetUuid) return this.assetRepository.getAssetWithSectorAndCountry(assetUuid);
          if (companyName) {
            const found = (await this.assetRepository.getAssetFromOfficialName(companyName))
              ?? (await this.assetRepository.getAssetFromTicker(companyName));
            return found ? this.assetRepository.getAssetWithSectorAndCountry(found.uuid) : null;
          }
          return null;
        })());
      }
      return assetCache.get(key)!;
    };

    // ── Pre-warm asset cache in parallel ────────────────────────────────────
    await Promise.all([
      ...buys.filter(b => b.asset_buy_share).map(b => resolveAsset(b.asset_uuid, b.company_name)),
      ...sells.filter(s => s.asset_sell_share).map(s => resolveAsset(s.asset_uuid, s.company_name)),
    ]);

    for (const buy of buys) {
      if (!buy.asset_buy_share) continue;
      const asset = await resolveAsset(buy.asset_uuid, buy.company_name);
      if (!asset?.uuid || !asset.base_currency_uuid) continue;

      if (!holdingMap.has(asset.uuid)) {
        holdingMap.set(asset.uuid, {
          companyName:      asset.official_name ?? buy.company_name ?? asset.uuid,
          sectorName:       (asset.sector as any)?.sector_name ?? null,
          countryName:      (asset.country as any)?.country_name ?? null,
          baseCurrencyUuid: asset.base_currency_uuid,
          shares:           0,
          marketValue:      0,
          isEtf:            asset.asset_type === AssetType.ETF,
        });
      }
      holdingMap.get(asset.uuid)!.shares += buy.asset_buy_share;
    }

    for (const sell of sells) {
      if (!sell.asset_sell_share) continue;
      const asset = await resolveAsset(sell.asset_uuid, sell.company_name);
      if (!asset?.uuid || !holdingMap.has(asset.uuid)) continue;
      holdingMap.get(asset.uuid)!.shares -= sell.asset_sell_share;
    }

    const today = new Date();

    // ── Bulk fetch all latest prices (1 query instead of N) ─────────────────
    const heldUuids = Array.from(holdingMap.entries())
      .filter(([, h]) => h.shares > 0.0001)
      .map(([uuid]) => uuid);

    const bulkPrices = heldUuids.length > 0
      ? await this.assetPriceRepository.getClosestPricesBeforeOrAtBulk(heldUuids, today)
      : [];
    const priceByUuid = new Map(bulkPrices.map(r => [r.asset_uuid, r.asset_price]));

    // ── Parallel forex rate lookups ──────────────────────────────────────────
    const mvEntries = await Promise.all(
      Array.from(holdingMap.entries()).map(async ([uuid, holding]) => {
        if (holding.shares <= 0.0001) return { uuid, mv: null as number | null };
        const price = priceByUuid.get(uuid);
        if (price == null) return { uuid, mv: null as number | null };
        const rate = await this.getRate(holding.baseCurrencyUuid, currencyId, today);
        return { uuid, mv: holding.shares * price * rate };
      })
    );

    let totalMv = 0;
    for (const { uuid, mv } of mvEntries) {
      if (mv == null) {
        holdingMap.delete(uuid);
      } else {
        holdingMap.get(uuid)!.marketValue = mv;
        totalMv += mv;
      }
    }

    if (totalMv === 0) return empty;

    // ── Expand ETF positions into underlying holdings ────────────────────────
    // ETFs are "look-through" for allocation, sector, and geographic breakdowns:
    // each ETF's market value is distributed across its underlying stocks
    // according to their percentage concentration in the ETF.
    // Non-ETF positions pass through unchanged.

    interface ExpandedHolding {
      companyName: string;
      sectorName:  string | null;
      countryName: string | null;
      marketValue: number;
    }

    // Fetch all ETF holdings data in parallel
    const etfUuids = Array.from(holdingMap.entries())
      .filter(([, h]) => h.isEtf && h.marketValue > 0)
      .map(([uuid]) => uuid);

    const etfHoldingsData = new Map<string, Array<{ pct: number; name: string; sector: string | null; country: string | null }>>();
    await Promise.all(
      etfUuids.map(async (uuid) => {
        const rows = await this.etfHoldingsRepository.getEtfHoldingsFromEtf(uuid);
        etfHoldingsData.set(uuid, rows.map(r => ({
          pct:     r.asset_percentage_concentration_in_etf,
          name:    (r.asset as any)?.official_name ?? "Unknown",
          sector:  (r.asset as any)?.sector?.sector_name ?? null,
          country: (r.asset as any)?.country?.country_name ?? null,
        })));
      })
    );

    const expandedHoldings: ExpandedHolding[] = [];

    for (const [uuid, holding] of holdingMap) {
      if (holding.marketValue <= 0) continue;

      if (holding.isEtf) {
        const underlyings = etfHoldingsData.get(uuid) ?? [];

        if (underlyings.length === 0) {
          // No holdings data — treat as a single opaque holding
          expandedHoldings.push({
            companyName: holding.companyName,
            sectorName:  holding.sectorName,
            countryName: holding.countryName,
            marketValue: holding.marketValue,
          });
          continue;
        }

        // Distribute ETF market value proportionally to each underlying
        let accountedPct = 0;
        for (const u of underlyings) {
          accountedPct += u.pct;
          expandedHoldings.push({
            companyName: u.name,
            sectorName:  u.sector,
            countryName: u.country,
            marketValue: holding.marketValue * (u.pct / 100),
          });
        }

        // Any unaccounted % (holdings data rarely sums to exactly 100) → "Other" bucket
        const remainingPct = 100 - accountedPct;
        if (remainingPct > 0.5) {
          expandedHoldings.push({
            companyName: `${holding.companyName} (Other)`,
            sectorName:  holding.sectorName,  // fallback to ETF-level category
            countryName: holding.countryName,
            marketValue: holding.marketValue * (remainingPct / 100),
          });
        }
      } else {
        expandedHoldings.push({
          companyName: holding.companyName,
          sectorName:  holding.sectorName,
          countryName: holding.countryName,
          marketValue: holding.marketValue,
        });
      }
    }

    const totalExpandedMv = expandedHoldings.reduce((s, h) => s + h.marketValue, 0);
    if (totalExpandedMv === 0) return empty;

    const topHoldings: TopHolding[] = [...expandedHoldings]
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, 6)
      .map(h => ({
        companyName: h.companyName,
        invested:    this.round(h.marketValue),
        allocation:  this.round((h.marketValue / totalExpandedMv) * 100),
      }));

    const sectorMap = new Map<string, number>();
    for (const h of expandedHoldings) {
      const key = h.sectorName ?? "Unknown";
      sectorMap.set(key, (sectorMap.get(key) ?? 0) + h.marketValue);
    }
    const sectorBreakdown: AllocationItem[] = Array.from(sectorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value:      this.round(value),
        allocation: this.round((value / totalExpandedMv) * 100),
      }));

    const countryMap = new Map<string, number>();
    for (const h of expandedHoldings) {
      const key = h.countryName ?? "Unknown";
      countryMap.set(key, (countryMap.get(key) ?? 0) + h.marketValue);
    }
    const countryBreakdown: AllocationItem[] = Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value:      this.round(value),
        allocation: this.round((value / totalExpandedMv) * 100),
      }));

    return { topHoldings, sectorBreakdown, countryBreakdown };
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

  private getRate(sourceCurrencyId: string, targetCurrencyId: string, date: Date): Promise<number> {
    if (sourceCurrencyId === targetCurrencyId) return Promise.resolve(1);
    const key = `${sourceCurrencyId}→${targetCurrencyId}@${date.toISOString().split("T")[0]}`;
    if (!this.rateCache.has(key)) {
      // Store the Promise — concurrent callers share one DB round-trip
      this.rateCache.set(
        key,
        this.currenciesRepository
          .getClosestForexRateBeforeOrAt(sourceCurrencyId, targetCurrencyId, date)
          .then(forex => forex?.forex_rate ?? 1)
          .catch(() => 1),
      );
    }
    return this.rateCache.get(key)!;
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
      topHoldings: [], sectorBreakdown: [], countryBreakdown: [], monthlyData: [], monthlyTwr: [],
      currencyId: currency.uuid, currencyName: currency.currency_name,
    };
  }
}
