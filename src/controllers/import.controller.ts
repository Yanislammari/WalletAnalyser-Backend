import { Request, Response } from "express";
import AzureBlobService from "../services/azure.blob.service";
import { AZURE_BLOB_STORAGE_CONTAINER_NAME_EXAMPLES } from "../constants/env";

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

  constructor() {
    this.azureBlobService = new AzureBlobService();
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
}

export default ImportController;
