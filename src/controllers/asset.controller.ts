import { Request, Response } from "express";
import { AssetService } from "../services/asset.service";
import { AssetDatabaseModel } from "../models";
import { AssetType } from "../dtos";

class AssetController {
  private readonly assetService: AssetService;

  constructor() {
    this.assetService = new AssetService();
  }

  public async getAllAssets(req: Request, res: Response): Promise<Response> {
    try {
      const type = req.query.type as string | undefined;
      const limit = Number(req.query.limit) || 100;
      const offset = Number(req.query.offset) || 0;
      const search = req.query.search as string | undefined;

      const response = await this.assetService.getAssets(type, offset, limit, search);
      return res.status(200).json(response);
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createAsset(req: Request, res: Response): Promise<Response> {
    try {
      const asset = new AssetDatabaseModel(
        req.body.official_name ?? null,
        req.body.ticker_name ?? null,
        AssetType.STOCKS,
        req.body.sector_uuid ?? null,
        req.body.country_uuid ?? null,
        req.body.base_currency_uuid ?? null
      );

      const createdAsset = await this.assetService.createAsset(asset);
      return res.status(201).json(createdAsset);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateAsset(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const asset = new AssetDatabaseModel(
        req.body.official_name ?? null,
        req.body.ticker_name ?? null,
        req.body.type ?? AssetType.STOCKS,
        req.body.sector_uuid ?? null,
        req.body.country_uuid ?? null,
        req.body.base_currency_uuid ?? null
      );

      const updatedAsset = await this.assetService.updateAsset(uuid, asset);
      if (!updatedAsset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      return res.status(200).json(updatedAsset);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteAsset(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.assetService.deleteAsset(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Asset not found" });
      }
      return res.status(200).json({ message: "Asset deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default AssetController;
