import { Request, Response } from "express";
import AzureBlobService from "../services/azure.blob.service";
import { AZURE_BLOB_STORAGE_CONTAINER_NAME_EXAMPLES } from "../constants/env";
import { CsvImportService, ImportHistoryItem, ImportResult } from "../services/portfolio/csv.import.service";

const TEMPLATE_FILES: Record<string, { filename: string; mimeType: string }> = {
  xlsx: {
    filename: "ASSETS_TRANSACTIONS_EXAMPLE_XLSX.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  xls: {
    filename: "ASSETS_TRANSACTIONS_EXAMPLE_XLS.xls",
    mimeType: "application/vnd.ms-excel",
  },
  csv: {
    filename: "ASSETS_TRANSACTIONS_EXAMPLE_CSV.csv",
    mimeType: "text/csv",
  },
};

class ImportController {
  private readonly azureBlobService: AzureBlobService;
  private readonly csvImportService: CsvImportService;

  constructor() {
    this.azureBlobService = new AzureBlobService();
    this.csvImportService = new CsvImportService();
  }

  public async downloadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const format: string = (req.params.format as string)?.toLowerCase();
      const template = TEMPLATE_FILES[format];

      if (!template) {
        res.status(400).json({ message: "Invalid format. Use xlsx, xls or csv." });
        return;
      }

      const buffer: Buffer<ArrayBufferLike> = await this.azureBlobService.getFile(
        AZURE_BLOB_STORAGE_CONTAINER_NAME_EXAMPLES,
        template.filename
      );

      res.setHeader("Content-Type", template.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${template.filename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    }
    catch (error) {
      res.status(500).json({ message: "Failed to download template" });
    }
  }

  /**
   * POST /import/portfolio/:portfolioId/csv
   * Accepts a multipart/form-data body with a single file field named "file".
   * Parses the CSV and bulk-imports buy/sell transactions into the given portfolio.
   */
  public async importCsv(req: Request, res: Response): Promise<void> {
    try {
      const portfolioId: string = req.params.portfolioId as string;
      if (!portfolioId) {
        res.status(400).json({ message: "portfolioId is required" });
        return;
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ message: "No file uploaded. Send a .csv file in the 'file' field." });
        return;
      }

      if (!file.originalname.toLowerCase().endsWith(".csv")) {
        res.status(400).json({ message: "Only .csv files are supported." });
        return;
      }

      const csvText: string = file.buffer.toString("utf-8");
      const result: ImportResult = await this.csvImportService.importCsv(
        portfolioId,
        csvText,
        file.originalname
      );

      res.status(200).json(result);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      res.status(500).json({ message });
    }
  }

  /**
   * GET /import/portfolio/:portfolioId/history
   * Returns the 20 most recent import records for the given portfolio.
   */
  public async getImportHistory(req: Request, res: Response): Promise<void> {
    try {
      const portfolioId: string = req.params.portfolioId as string;
      if (!portfolioId) {
        res.status(400).json({ message: "portfolioId is required" });
        return;
      }

      const history: ImportHistoryItem[] = await this.csvImportService.getImportHistory(portfolioId);
      res.status(200).json(history);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch import history";
      res.status(500).json({ message });
    }
  }
}

export default ImportController;
