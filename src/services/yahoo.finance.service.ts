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
