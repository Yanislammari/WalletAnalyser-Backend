import { Request, Response } from "express";
import { AssetService } from "../services/asset.service";
import { AssetResponseDto } from "../dtos/asset/responses/asset.response.dto";
import { AssetPriceResponseDto } from "../dtos/asset/responses/asset.price.response.dto";

class AssetController {
  private readonly assetService: AssetService;

  constructor() {
    this.assetService = new AssetService();
  }

  public async getAll(_req: Request, res: Response): Promise<Response> {
    try {
      const assets: AssetResponseDto[] = await this.assetService.getAllAssets();
      return res.status(200).json(assets);
    }
    catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getPrice(req: Request, res: Response): Promise<Response> {
    try {
      const assetId: string = req.params.assetId as string;
      const dateParam: string | undefined = req.query.date as string | undefined;

      if (!dateParam) {
        return res.status(400).json({ message: "Missing required query parameter: date" });
      }

      const result: AssetPriceResponseDto | null = await this.assetService.getAssetPrice(assetId, dateParam);

      if (!result) {
        return res.status(404).json({ message: "No price found for this asset" });
      }

      return res.status(200).json(result);
    }
    catch (error) {
      if (error instanceof Error && error.message === "ASSET_NOT_FOUND") {
        return res.status(404).json({ message: "Asset not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default AssetController;
