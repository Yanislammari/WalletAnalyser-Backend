import { AssetRepository } from "../../repositories/asset/asset.repository";
import { AssetPriceRepository } from "../../repositories/asset/asset_price.repository";
import { CurrenciesRepository } from "../../repositories/currencies/currencies.repository";
import { ImportHistoryRepository } from "../../repositories/portfolio/import_history.repository";
import { AssetService } from "../asset/asset.service";
import { PortfolioService } from "./portfolio.service";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImportRowError {
  row: number;
  ticker: string;
  reason: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportRowError[];
}

export interface ImportHistoryItem {
  id: string;
  filename: string | null;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: ImportRowError[];
  createdAt: string; // ISO 8601 string (serialized from DB timestamp)
}

// ─── Internal CSV row ─────────────────────────────────────────────────────────

interface ParsedRow {
  ticker:   string;
  type:     string;
  date:     string;
  shares:   string;
  amount:   string;
  currency: string; // optional — ISO code e.g. "EUR", "USD"
}

// ─── Rounding helpers ─────────────────────────────────────────────────────────

/** Round to 2 decimal places (monetary amounts) */
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Round to 6 decimal places (share quantities & unit prices) */
const r6 = (v: number): number => Math.round(v * 1_000_000) / 1_000_000;

// ─── Service ──────────────────────────────────────────────────────────────────

export class CsvImportService {
  private readonly assetRepository:         AssetRepository;
  private readonly assetPriceRepository:    AssetPriceRepository;
  private readonly currenciesRepository:    CurrenciesRepository;
  private readonly importHistoryRepository: ImportHistoryRepository;
  private readonly assetService:            AssetService;
  private readonly portfolioService:        PortfolioService;

  constructor() {
    this.assetRepository         = new AssetRepository();
    this.assetPriceRepository    = new AssetPriceRepository();
    this.currenciesRepository    = new CurrenciesRepository();
    this.importHistoryRepository = new ImportHistoryRepository();
    this.assetService            = new AssetService();
    this.portfolioService        = new PortfolioService();
  }

  // ─── CSV parsing ────────────────────────────────────────────────────────────

  /**
   * Parses a raw CSV string into typed rows.
   * - Normalises line endings (CRLF → LF)
   * - Uses first row as lowercase headers
   * - Required columns: ticker, type, date
   * - Optional columns: shares, amount, currency
   */
  private parseCsv(text: string): ParsedRow[] {
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV must contain a header row and at least one data row");
    }

    const headers   = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const idx       = (name: string) => headers.indexOf(name);

    const tickerIdx   = idx("ticker");
    const typeIdx     = idx("type");
    const dateIdx     = idx("date");
    const sharesIdx   = idx("shares");
    const amountIdx   = idx("amount");
    const currencyIdx = idx("currency");

    if (tickerIdx === -1 || typeIdx === -1 || dateIdx === -1) {
      throw new Error("CSV header must include at least: ticker, type, date");
    }

    return lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim());
      return {
        ticker:   vals[tickerIdx]                                    ?? "",
        type:     vals[typeIdx]                                      ?? "",
        date:     vals[dateIdx]                                      ?? "",
        shares:   sharesIdx   !== -1 ? (vals[sharesIdx]   ?? "") : "",
        amount:   amountIdx   !== -1 ? (vals[amountIdx]   ?? "") : "",
        currency: currencyIdx !== -1 ? (vals[currencyIdx] ?? "") : "",
      };
    });
  }

  // ─── Main import ─────────────────────────────────────────────────────────────

  public async importCsv(
    portfolioId: string,
    csvText: string,
    filename?: string
  ): Promise<ImportResult> {
    let rows: ParsedRow[];
    try {
      rows = this.parseCsv(csvText);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Invalid CSV format");
    }

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (const [i, row] of rows.entries()) {
      const rowNum = i + 2; // +1 for 1-index, +1 for header
      try {
        await this.processRow(portfolioId, row, rowNum);
        result.imported++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        if (reason === "INSUFFICIENT_SHARES") {
          result.skipped++;
          result.errors.push({
            row: rowNum,
            ticker: row.ticker || "?",
            reason: "Not enough shares available on this date to sell",
          });
        } else {
          result.errors.push({
            row: rowNum,
            ticker: row.ticker || "?",
            reason,
          });
        }
      }
    }

    // ── Persist import history ────────────────────────────────────────────────
    await this.importHistoryRepository.add({
      portfolio_uuid: portfolioId,
      filename:       filename ?? null,
      imported_count: result.imported,
      skipped_count:  result.skipped,
      error_count:    result.errors.length,
      errors_json:    JSON.stringify(result.errors),
    } as any);

    return result;
  }

  // ─── Import history ───────────────────────────────────────────────────────────

  public async getImportHistory(portfolioId: string): Promise<ImportHistoryItem[]> {
    const records = await this.importHistoryRepository.getByPortfolioId(portfolioId);
    return records.map((r) => {
      // With dateStrings:true in Sequelize config, createdAt may arrive as a raw
      // Postgres string ("2026-07-08 12:30:00+00") which browsers can't parse.
      // Node's Date constructor handles the space-separated format; we then emit
      // a proper ISO 8601 string so every client can parse it correctly.
      // With dateStrings:true the driver may return "2026-07-08 12:30:00.123456+00".
      // 1. If it's already a real Date object — just call toISOString().
      // 2. Otherwise normalise: space→T, strip microseconds, then parse.
      // 3. Fallback to "now" so the frontend never receives an unparseable string.
      let createdAtIso: string;
      const raw: unknown = r.createdAt;
      if (raw instanceof Date && !isNaN(raw.getTime())) {
        createdAtIso = raw.toISOString();
      } else {
        const str = String(raw ?? "")
          .replace(" ", "T")          // "2026-07-08 12:..." → "2026-07-08T12:..."
          .replace(/(\.\d{3})\d+/, "$1"); // truncate microseconds to milliseconds
        const d = new Date(str);
        createdAtIso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      }

      return {
        id:            r.uuid,
        filename:      r.filename,
        importedCount: r.imported_count,
        skippedCount:  r.skipped_count,
        errorCount:    r.error_count,
        errors:        JSON.parse(r.errors_json) as ImportRowError[],
        createdAt:     createdAtIso,
      };
    });
  }

  // ─── Row processor ───────────────────────────────────────────────────────────

  private async processRow(portfolioId: string, row: ParsedRow, _rowNum: number): Promise<void> {
    // ── 1. Validate required fields ──────────────────────────────────────────
    if (!row.ticker) throw new Error("Missing ticker");
    if (!row.type)   throw new Error("Missing type");
    if (!row.date)   throw new Error("Missing date");

    const type = row.type.toLowerCase().trim();
    if (type !== "buy" && type !== "sell") {
      throw new Error(`type must be "buy" or "sell", got "${row.type}"`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      throw new Error(`date must be YYYY-MM-DD, got "${row.date}"`);
    }

    const sharesRaw = row.shares ? parseFloat(row.shares) : undefined;
    const amountRaw = row.amount ? parseFloat(row.amount) : undefined;

    if (sharesRaw !== undefined && isNaN(sharesRaw)) throw new Error("shares is not a valid number");
    if (amountRaw !== undefined && isNaN(amountRaw)) throw new Error("amount is not a valid number");

    const sharesOk = sharesRaw !== undefined && sharesRaw > 0;
    const amountOk = amountRaw !== undefined && amountRaw > 0;

    if (type === "sell" && !sharesOk) {
      throw new Error("shares (> 0) is required for sells");
    }
    if (type === "buy" && !sharesOk && !amountOk) {
      throw new Error("provide shares or amount (or both) for buys");
    }

    // ── 2. Resolve asset ─────────────────────────────────────────────────────
    const tickerUpper = row.ticker.toUpperCase();
    let asset = await this.assetRepository.getAssetFromTicker(tickerUpper);

    if (!asset) {
      const dto = await this.assetService.createCustomAsset(tickerUpper);
      asset = await this.assetRepository.getAssetFromUUID(dto.id);
    }

    if (!asset) throw new Error(`Could not find or create asset for ticker "${row.ticker}"`);

    // ── 3. Resolve currency ──────────────────────────────────────────────────
    let currencyId = asset.base_currency_uuid;
    if (!currencyId) throw new Error(`Asset "${row.ticker}" has no base currency — cannot import`);

    const currencyCode = row.currency?.toUpperCase().trim();
    if (currencyCode) {
      const currency = await this.currenciesRepository.getCurenciesFromDb(currencyCode);
      if (!currency) {
        throw new Error(`Unknown currency code "${currencyCode}" — use ISO codes like EUR, USD, GBP`);
      }
      currencyId = currency.uuid;
    }

    // ── 4. Fetch closest historical price ────────────────────────────────────
    const priceRecord = await this.assetPriceRepository.getClosestPriceBeforeOrAt(
      asset.uuid,
      new Date(row.date)
    );
    const historicalPrice = priceRecord?.asset_price ?? null;

    // ── 5. Derive missing shares / amount / price — with proper rounding ─────
    let finalShares = sharesOk ? r6(sharesRaw!) : undefined;
    let finalAmount = amountOk ? r2(amountRaw!) : undefined;
    let finalPrice: number | undefined;

    if (finalShares && finalAmount) {
      // Both given — derive unit price
      finalPrice = r6(finalAmount / finalShares);
    } else if (finalShares && historicalPrice) {
      finalPrice  = r6(historicalPrice);
      finalAmount = r2(finalShares * historicalPrice);
    } else if (finalAmount && historicalPrice) {
      finalPrice  = r6(historicalPrice);
      finalShares = r6(finalAmount / historicalPrice);
    } else {
      throw new Error(
        `Cannot determine price for "${row.ticker}" on ${row.date}: no historical price found in DB. ` +
        "Provide both shares and amount to bypass the price lookup."
      );
    }

    // ── 6. Persist ───────────────────────────────────────────────────────────
    if (type === "buy") {
      await this.portfolioService.addAssetBuy({
        portfolioId,
        assetId:               asset.uuid,
        buyCurrencyId:         currencyId,
        buyDate:               row.date,
        assetBuyAmount:        finalAmount,
        assetBuyShare:         finalShares,
        assetBuyPricePerShare: finalPrice,
      });
    } else {
      await this.portfolioService.addAssetSell({
        portfolioId,
        assetId:         asset.uuid,
        sellCurrencyId:  currencyId,
        sellDate:        row.date,
        assetSellAmount: finalAmount,
        assetSellShare:  finalShares!,
      });
    }
  }
}
