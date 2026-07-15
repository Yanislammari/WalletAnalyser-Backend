import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";
import { Asset, Currency, Forex, ForexRate, attributesForex, attributesForexRate } from "../../db_schema";
import { Op } from "sequelize";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user.asset.buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user.asset.sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user.asset.dividend.repository";
import { AssetPriceRepository } from "../../repositories/asset/asset_price.repository";
import { AssetRepository } from "../../repositories/asset/asset.repository";
import { MetricResponseDto, DashboardResponseDto, TopHolding, AllocationItem, MonthlyDataPoint, MonthlyTwrPoint } from "../../dtos/portfolio/responses/metric.response.dto";
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
  private readonly buyRepository:        UserAssetBuyRepository;
  private readonly sellRepository:       UserAssetSellRepository;
  private readonly dividendRepository:   UserAssetDividendRepository;
  private readonly currenciesRepository: CurrenciesRepository;
  private readonly assetPriceRepository: AssetPriceRepository;
  private readonly assetRepository:      AssetRepository;
  // Promise-based dedup cache: concurrent calls for the same key share one DB query
  private readonly rateCache       = new Map<string, Promise<number>>();
  private readonly forexPairCache  = new Map<string, Promise<string | null>>();

  constructor() {
    this.buyRepository        = new UserAssetBuyRepository();
    this.sellRepository       = new UserAssetSellRepository();
    this.dividendRepository   = new UserAssetDividendRepository();
    this.currenciesRepository = new CurrenciesRepository();
    this.assetPriceRepository = new AssetPriceRepository();
    this.assetRepository      = new AssetRepository();
  }

  // ─── Public entry point ────────────────────────────────────────────────────

  public async getMetrics(portfolioId: string, currencyId: string, fromDate?: string, portfolioMarketValue?: number): Promise<MetricResponseDto> {

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

    // ── All three loops run concurrently — DB round-trips overlap ────────────
    let costBasisOfSells = 0;

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
        const costBasis = (sell.asset_sell_share != null && sell.average_asset_share_buy_price != null)
          ? sell.asset_sell_share * sell.average_asset_share_buy_price * rate
          : 0;
        return { flow: { date: sellDate, amount: amount * rate, type: "sell" as FlowType, company: sell.company_name ?? undefined }, costBasis };
      })),
      Promise.all(dividends.map(async (div) => {
        const exDate = new Date(div.cashflow_date);
        if (exDate > today) return null;
        if (filterFrom && exDate < filterFrom) return null;
        const rate = await this.getRate(div.currency_uuid, currencyId, exDate);
        return { date: exDate, amount: div.cashflow_amount * rate, type: "dividend" as FlowType };
      })),
    ]);

    for (const f of buyFlows)  if (f) flows.push(f);
    for (const r of sellResults) {
      if (r) { flows.push(r.flow); costBasisOfSells += r.costBasis; }
    }
    for (const f of divFlows)  if (f) flows.push(f);

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

    const trackerMap  = new Map<string, AssetTracker>();
    const assetCache  = new Map<string, Asset | null>();

    const resolveAsset = async (assetUuid: string | null, companyName: string | null): Promise<Asset | null> => {
      const cacheKey = assetUuid ?? `name:${companyName}`;
      if (assetCache.has(cacheKey)) return assetCache.get(cacheKey)!;
      let asset: Asset | null = null;
      if (assetUuid) {
        asset = await this.assetRepository.getAssetFromUUID(assetUuid);
      } else if (companyName) {
        asset = await this.assetRepository.getAssetFromOfficialName(companyName)
          ?? await this.assetRepository.getAssetFromTicker(companyName);
      }
      assetCache.set(cacheKey, asset);
      return asset;
    };

    // Resolve all buy assets in parallel
    await Promise.all(buys.map(async (buy) => {
      if (!buy.asset_buy_share) return;
      const asset = await resolveAsset(buy.asset_uuid, buy.company_name);
      if (!asset?.uuid || !asset?.base_currency_uuid) return;
      if (!trackerMap.has(asset.uuid)) {
        trackerMap.set(asset.uuid, { baseCurrencyUuid: asset.base_currency_uuid, buys: [], sells: [], prices: [] });
      }
      trackerMap.get(asset.uuid)!.buys.push({ date: new Date(buy.buy_date), shares: buy.asset_buy_share });
    }));

    // Resolve all sell assets in parallel
    await Promise.all(sells.map(async (sell) => {
      if (!sell.asset_sell_share) return;
      const asset = await resolveAsset(sell.asset_uuid, sell.company_name);
      if (!asset?.uuid || !trackerMap.has(asset.uuid)) return;
      trackerMap.get(asset.uuid)!.sells.push({ date: new Date(sell.sell_date), shares: sell.asset_sell_share });
    }));

    // Fetch all historical prices in parallel
    await Promise.all([...trackerMap.entries()].map(async ([uuid, tracker]) => {
      const allPrices = await this.assetPriceRepository.getAllPricesForAsset(uuid);
      tracker.prices = allPrices.map(p => ({ date: new Date(p.asset_price_date), price: p.asset_price }));
    }));

    // All months computed in parallel; within each month all assets are parallel too
    await Promise.all(monthKeys.map(async (monthKey) => {
      const [year, month] = monthKey.split("-").map(Number);
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));

      const perAssetValues = await Promise.all(
        [...trackerMap.values()].map(async (tracker) => {
          const sharesHeld =
            tracker.buys.filter(b  => b.date  <= endOfMonth).reduce((s, b) => s + b.shares, 0) -
            tracker.sells.filter(sl => sl.date <= endOfMonth).reduce((s, sl) => s + sl.shares, 0);

          if (sharesHeld <= 0.0001) return 0;

          const price = this.findPriceAtOrBefore(tracker.prices, endOfMonth);
          if (price === null) return 0;

          const rate = await this.getRate(tracker.baseCurrencyUuid, currencyId, endOfMonth);
          return sharesHeld * price * rate;
        })
      );

      result.set(monthKey, perAssetValues.reduce((s, v) => s + v, 0));
    }));

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
    }

    const holdingMap = new Map<string, Holding>();
    const assetCache = new Map<string, Asset | null>();

    const resolveAsset = async (assetUuid: string | null, companyName: string | null): Promise<Asset | null> => {
      const key = assetUuid ?? `name:${companyName}`;
      if (assetCache.has(key)) return assetCache.get(key)!;
      let asset: Asset | null = null;
      if (assetUuid) {
        asset = await this.assetRepository.getAssetWithSectorAndCountry(assetUuid);
      } else if (companyName) {
        const found = await this.assetRepository.getAssetFromOfficialName(companyName)
          ?? await this.assetRepository.getAssetFromTicker(companyName);
        asset = found ? await this.assetRepository.getAssetWithSectorAndCountry(found.uuid) : null;
      }
      assetCache.set(key, asset);
      return asset;
    };

    // Resolve all buy assets in parallel
    await Promise.all(buys.map(async (buy) => {
      if (!buy.asset_buy_share) return;
      const asset = await resolveAsset(buy.asset_uuid, buy.company_name);
      if (!asset?.uuid || !asset.base_currency_uuid) return;
      if (!holdingMap.has(asset.uuid)) {
        holdingMap.set(asset.uuid, {
          companyName:      asset.official_name ?? buy.company_name ?? asset.uuid,
          sectorName:       (asset.sector as any)?.sector_name ?? null,
          countryName:      (asset.country as any)?.country_name ?? null,
          baseCurrencyUuid: asset.base_currency_uuid,
          shares:           0,
          marketValue:      0,
        });
      }
      holdingMap.get(asset.uuid)!.shares += buy.asset_buy_share;
    }));

    // Resolve all sell assets in parallel
    await Promise.all(sells.map(async (sell) => {
      if (!sell.asset_sell_share) return;
      const asset = await resolveAsset(sell.asset_uuid, sell.company_name);
      if (!asset?.uuid || !holdingMap.has(asset.uuid)) return;
      holdingMap.get(asset.uuid)!.shares -= sell.asset_sell_share;
    }));

    const today = new Date();
    let totalMv = 0;

    // Fetch latest prices + rates for all holdings in parallel
    const holdingEntries = [...holdingMap.entries()];
    const priceResults = await Promise.all(
      holdingEntries.map(async ([uuid, holding]) => {
        if (holding.shares <= 0.0001) return { uuid, remove: true };
        const latestPrice = await this.assetPriceRepository.getLatestAssetPrice(uuid);
        if (!latestPrice) return { uuid, remove: true };
        const rate = await this.getRate(holding.baseCurrencyUuid, currencyId, today);
        return { uuid, remove: false, marketValue: holding.shares * latestPrice.asset_price * rate };
      })
    );

    for (const r of priceResults) {
      if (r.remove) { holdingMap.delete(r.uuid); continue; }
      holdingMap.get(r.uuid)!.marketValue = r.marketValue!;
      totalMv += r.marketValue!;
    }

    if (totalMv === 0) return empty;

    const holdings = Array.from(holdingMap.values()).filter(h => h.marketValue > 0);

    const topHoldings: TopHolding[] = holdings
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, 6)
      .map(h => ({
        companyName: h.companyName,
        invested:    this.round(h.marketValue),
        allocation:  this.round((h.marketValue / totalMv) * 100),
      }));

    const sectorMap = new Map<string, number>();
    for (const h of holdings) {
      const key = h.sectorName ?? "Unknown";
      sectorMap.set(key, (sectorMap.get(key) ?? 0) + h.marketValue);
    }
    const sectorBreakdown: AllocationItem[] = Array.from(sectorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value:      this.round(value),
        allocation: this.round((value / totalMv) * 100),
      }));

    const countryMap = new Map<string, number>();
    for (const h of holdings) {
      const key = h.countryName ?? "Unknown";
      countryMap.set(key, (countryMap.get(key) ?? 0) + h.marketValue);
    }
    const countryBreakdown: AllocationItem[] = Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value:      this.round(value),
        allocation: this.round((value / totalMv) * 100),
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
    const dateStr = date.toISOString().split("T")[0];
    const key     = `${sourceCurrencyId}→${targetCurrencyId}@${dateStr}`;
    if (!this.rateCache.has(key)) {
      this.rateCache.set(key, this.fetchRate(sourceCurrencyId, targetCurrencyId, date));
    }
    return this.rateCache.get(key)!;
  }

  // Separate fetcher — cached forex pair UUID avoids a duplicate Forex.findOne per rate call
  private fetchRate(sourceCurrencyId: string, targetCurrencyId: string, date: Date): Promise<number> {
    const pairKey = `${sourceCurrencyId}→${targetCurrencyId}`;
    if (!this.forexPairCache.has(pairKey)) {
      this.forexPairCache.set(pairKey,
        Forex.findOne({ where: { [attributesForex.base_currency]: sourceCurrencyId, [attributesForex.quote_currency]: targetCurrencyId } })
          .then((f: Forex | null) => f?.uuid ?? null)
          .catch(() => null)
      );
    }
    return this.forexPairCache.get(pairKey)!.then(async (forexUuid: string | null) => {
      if (!forexUuid) return 1;
      try {
        const row = await ForexRate.findOne({
          where: { [attributesForexRate.forex_uuid]: forexUuid, [attributesForexRate.forex_rate_date]: { [Op.lte]: date } },
          order: [[attributesForexRate.forex_rate_date, "DESC"]],
        });
        return row?.forex_rate ?? 1;
      } catch { return 1; }
    });
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

  // ─── Dashboard data (free tier) ───────────────────────────────────────────

  public async getDashboardData(portfolioId: string, currencyId: string): Promise<DashboardResponseDto> {

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

    const flows: CashFlow[] = [];

    // All three loops run concurrently
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

    const totalInvested = flows.filter(f => f.type === "buy").reduce((s, f) => s + f.amount, 0);

    const [monthlyData, { topHoldings: topHoldingsMv, sectorBreakdown, countryBreakdown }] = await Promise.all([
      this.computeMonthlyData(flows, buys, sells, currencyId, today),
      this.computeHoldingsBreakdown(buys, sells, currencyId),
    ]);

    const topHoldings = topHoldingsMv.length > 0
      ? topHoldingsMv
      : this.computeTopHoldings(flows, totalInvested);

    return {
      monthlyData,
      topHoldings,
      sectorBreakdown,
      countryBreakdown,
      currencyId:   targetCurrency.uuid,
      currencyName: targetCurrency.currency_name,
    };
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
