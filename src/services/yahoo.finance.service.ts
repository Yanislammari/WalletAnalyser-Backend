import YahooFinance from "yahoo-finance2";

interface YahooQuoteResult {
  symbol: string;
  currency?: string;
}

interface YahooForexQuote {
  regularMarketPrice?: number;
}

interface YahooValidationError extends Error {
  result?: unknown;
}

const TICKER_SUFFIX_CURRENCY_MAP: Record<string, string> = {
  // Europe - EUR
  ".PA": "EUR", ".AS": "EUR", ".DE": "EUR", ".MI": "EUR", ".MC": "EUR",
  ".BR": "EUR", ".LS": "EUR", ".HE": "EUR", ".AT": "EUR", ".VI": "EUR",
  ".PR": "EUR", ".F":  "EUR", ".BE": "EUR", ".MU": "EUR", ".HA": "EUR",
  ".DU": "EUR", ".IR": "EUR", ".AM": "EUR",
  // UK - GBP
  ".L":  "GBP", ".IL": "GBP",
  // Switzerland - CHF
  ".SW": "CHF", ".VX": "CHF", ".ZU": "CHF",
  // Scandinavia
  ".ST": "SEK", ".CO": "DKK", ".OL": "NOK",
  // Canada - CAD
  ".TO": "CAD", ".V":  "CAD", ".CN": "CAD",
  // Australia - AUD
  ".AX": "AUD",
  // Japan - JPY
  ".T":  "JPY",
  // Hong Kong - HKD
  ".HK": "HKD",
  // China - CNY
  ".SZ": "CNY", ".SS": "CNY",
  // India - INR
  ".BO": "INR", ".NS": "INR",
  // Brazil - BRL
  ".SA": "BRL",
  // Mexico - MXN
  ".MX": "MXN",
  // South Africa - ZAR
  ".JO": "ZAR",
  // New Zealand - NZD
  ".NZ": "NZD",
  // Singapore - SGD
  ".SI": "SGD",
  // Malaysia - MYR
  ".KL": "MYR",
  // Thailand - THB
  ".BK": "THB",
  // South Korea - KRW
  ".KS": "KRW", ".KQ": "KRW",
  // Taiwan - TWD
  ".TW": "TWD", ".TWO": "TWD",
  // Israel - ILS
  ".TA": "ILS",
  // Reuters/Bloomberg US formats → USD
  ".N":  "USD", ".O":  "USD", ".A":  "USD", ".P":  "USD",
  ".K":  "USD", ".US": "USD", ".NQ": "USD", ".NY": "USD",
};

const YAHOO_CURRENCY_CHUNK_SIZE = 50;
const YAHOO_CURRENCY_CHUNK_DELAY_MS = 300;

export class YahooFinanceService {
  private readonly yahooFinance: InstanceType<typeof YahooFinance>;

  constructor() {
    this.yahooFinance = new YahooFinance();
  }

  public async fetchCurrenciesForTickers(tickers: string[]): Promise<Map<string, string>> {
    const result: Map<string, string> = new Map<string, string>();

    if (tickers.length === 0) {
      return result;
    }

    // Phase 1: fetch from Yahoo in small chunks
    const chunks: string[][] = this.chunkArray(tickers, YAHOO_CURRENCY_CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        await this.sleep(YAHOO_CURRENCY_CHUNK_DELAY_MS);
      }

      let rawQuotes: unknown;

      try {
        rawQuotes = await this.yahooFinance.quote(chunks[i]);
      }
      catch (err: unknown) {
        const validationErr = err as YahooValidationError;
        if (validationErr.result != null) {
          rawQuotes = validationErr.result;
        }
      }

      const quotes: YahooQuoteResult[] = Array.isArray(rawQuotes)
        ? (rawQuotes as YahooQuoteResult[])
        : [];

      for (const quote of quotes) {
        if (quote.symbol && quote.currency) {
          result.set(quote.symbol, quote.currency);
        }
      }
    }

    // Phase 2: fallback — infer currency from ticker suffix for unresolved tickers
    for (const ticker of tickers) {
      if (result.has(ticker)) {
        continue;
      }

      const inferred: string | null = this.inferCurrencyFromSuffix(ticker);
      if (inferred) {
        result.set(ticker, inferred);
      }
    }

    return result;
  }

  public async getExchangeRate(from: string, to: string): Promise<number> {
    const fromUpper: string = from.toUpperCase();
    const toUpper: string = to.toUpperCase();

    if (fromUpper === toUpper) {
      return 1;
    }

    const pair: string = `${fromUpper}${toUpper}=X`;

    try {
      const quote: unknown = await this.yahooFinance.quote(pair);
      const price: number | undefined = (quote as YahooForexQuote)?.regularMarketPrice;
      return price ?? 1;
    }
    catch (err: unknown) {
      const validationErr = err as YahooValidationError;
      if (validationErr.result != null) {
        const results: unknown[] = Array.isArray(validationErr.result)
          ? (validationErr.result as unknown[])
          : [validationErr.result];
        const price: number | undefined = (results[0] as YahooForexQuote)?.regularMarketPrice;
        return price ?? 1;
      }
      return 1;
    }
  }

  private inferCurrencyFromSuffix(ticker: string): string {
    for (const [suffix, currency] of Object.entries(TICKER_SUFFIX_CURRENCY_MAP)) {
      if (ticker.toUpperCase().endsWith(suffix.toUpperCase())) {
        return currency;
      }
    }

    // No exchange suffix or unknown suffix → default to USD
    return "USD";
  }

  public async fetchHistoricalData(ticker: string, from: Date, to: Date): Promise<Array<{ date: Date; price: number }>> {
    // Use chart() directly — historical() relied on a Yahoo API that has been removed.
    // chart() returns { quotes: [{ date, open, high, low, close, volume, adjclose }] }
    type ChartQuote = { date?: Date; adjclose?: number | null; close?: number | null };

    const extractQuotes = (result: unknown): Array<{ date: Date; price: number }> => {
      const quotes: ChartQuote[] = (result as { quotes?: ChartQuote[] })?.quotes ?? [];
      return quotes
        .filter((q) => q.date != null && (q.adjclose != null || q.close != null))
        .map((q) => ({ date: q.date!, price: q.adjclose ?? q.close ?? 0 }));
    };

    try {
      const result = await (this.yahooFinance as any).chart(ticker, {
        period1: from,
        period2: to,
        interval: "1d",
      }, { validateResult: false });
      const quotes = extractQuotes(result);
      if (quotes.length === 0) {
        console.warn(`[YahooFinance] chart() returned 0 quotes for ${ticker} — result keys: ${result ? Object.keys(result) : 'null'}, quotes field: ${JSON.stringify(result?.quotes?.slice(0,1))}`);
      }
      return quotes;
    }
    catch (err: unknown) {
      // chart() throws with .result when schema validation fails — still use the data
      const validationErr = err as { result?: unknown };
      if (validationErr.result != null) {
        const quotes = extractQuotes(validationErr.result);
        console.log(`[YahooFinance] chart() validation error for ${ticker} but recovered ${quotes.length} quotes from err.result`);
        return quotes;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[YahooFinance] chart() FAILED for ${ticker}: [${(err as any)?.constructor?.name}] ${errMsg}`);
      return [];
    }
  }

  public async fetchHistoricalDividends(ticker: string, from: Date, to: Date): Promise<Array<{ date: Date; dividends: number }>> {
    // historical() with events:"dividends" still works (chart() events path is less stable).
    // Disable schema validation so a null currency field doesn't block dividend extraction.
    const parseRows = (raw: unknown[]): Array<{ date: Date; dividends: number }> =>
      (raw as Array<{ date?: Date; dividends?: number }>)
        .filter((row) => row.date != null && row.dividends != null && row.dividends > 0) as Array<{ date: Date; dividends: number }>;

    try {
      const rows = await this.yahooFinance.historical(ticker, {
        period1: from,
        period2: to,
        events: "dividends",
      }, { validateResult: false } as any);
      return parseRows(rows as unknown[]);
    }
    catch (err: unknown) {
      const validationErr = err as { result?: unknown };
      if (validationErr.result != null) {
        const raw: unknown[] = Array.isArray(validationErr.result)
          ? (validationErr.result as unknown[])
          : [validationErr.result];
        return parseRows(raw);
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!errMsg.includes("No data found") && !errMsg.includes("period1 and period2")) {
        console.error(`YahooFinanceService.fetchHistoricalDividends error for ${ticker}:`, errMsg);
      }
      return [];
    }
  }

  public async fetchAssetQuote(ticker: string): Promise<{
    ticker: string;
    officialName: string | null;
    currency: string | null;
    price: number | null;
    assetType: string | null;
  } | null> {
    try {
      const result = await this.yahooFinance.quoteSummary(ticker.toUpperCase(), {
        modules: ["price"],
      }) as any;

      const price = result?.price;
      if (!price) return null;

      return {
        ticker: ticker.toUpperCase(),
        officialName: price.longName ?? price.shortName ?? null,
        currency: price.currency ?? null,
        price: price.regularMarketPrice ?? null,
        assetType: price.quoteType ?? null,
      };
    }
    catch {
      return null;
    }
  }

  public sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
