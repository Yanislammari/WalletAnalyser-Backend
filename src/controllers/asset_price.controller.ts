import { Request, Response } from "express";
import { AssetPriceService } from "../services/asset/asset_price.service";

class AssetPriceController {
  private readonly assetPriceService: AssetPriceService;

  constructor() {
    this.assetPriceService = new AssetPriceService();
  }

  public async getAllAssetPrices(req: Request, res: Response): Promise<Response> {
    try {
      const asset_uuid = req.params.asset_uuid as string;
      const offset = Number(req.query.offset) || 0;
      const size = Number(req.query.size) || 100;
      let from: Date | null = new Date(req.query.from as string);
      let to: Date | null = new Date(req.query.to as string);

      if (isNaN(from.getTime())) {
        from = null;
      }
      if (isNaN(to.getTime())) {
        to = null;
      }

      const response = await this.assetPriceService.getAllAssetPrices(asset_uuid, offset, size, from, to);
      return res.status(200).json(response);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateAssetPrices(req: Request, res: Response): Promise<Response> {
        try {
      const asset_uuid = req.params.asset_uuid as string;
      const offset = Number(req.query.offset) || 0;
      const size = Number(req.query.size) || 100;
      let from: Date | null = new Date(req.query.from as string);
      let to: Date | null = new Date(req.query.to as string);

      if (isNaN(from.getTime())) {
        from = null;
      }
      if (isNaN(to.getTime())) {
        to = null;
      }
      const numberOfAdd = await this.assetPriceService.updateAssetPricesFromApi(asset_uuid)
      const response = await this.assetPriceService.getAllAssetPrices(asset_uuid, offset, size, from, to);
      return res.status(200).json({response, message : `We added ${numberOfAdd} prices to the stocks`});
    } catch (error) {
      if(error instanceof Error && error.message == "UNFOUND_TICKER") {
        return res.status(404).json({message : "The ticker does not exist"})
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createAssetPrice(req: Request, res: Response): Promise<Response> {
    try {
      const asset_uuid = req.params.asset_uuid as string;
      const { asset_price_date, asset_price } = req.body;

      if (!asset_price_date || asset_price === undefined) {
        return res.status(400).json({ message: "asset_price_date and asset_price are required" });
      }

      const assetPrice = await this.assetPriceService.createAssetPrice(
        asset_uuid,
        new Date(asset_price_date),
        parseFloat(asset_price)
      );
      return res.status(201).json(assetPrice);
    } catch (error) {
      if (error instanceof Error && error.message === "EXIST") {
        return res.status(500).json({ message: "A price at this date already exist" });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateAssetPrice(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const { asset_price_date, asset_price } = req.body;

      if (!asset_price_date && asset_price === undefined) {
        return res.status(400).json({ message: "asset_price_date or asset_price is required" });
      }

      const updateData: { asset_price_date?: Date; asset_price?: number } = {};
      if (asset_price_date) updateData.asset_price_date = new Date(asset_price_date);
      if (asset_price !== undefined) updateData.asset_price = parseFloat(asset_price);

      const assetPrice = await this.assetPriceService.updateAssetPrice(uuid, updateData);
      if (!assetPrice) {
        return res.status(404).json({ message: "Asset price not found" });
      }
      return res.status(200).json(assetPrice);
    } catch (error) {
      if (error instanceof Error && error.message === "EXIST") {
        return res.status(500).json({ message: "Une valeur à cette date existe déjà" });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteAssetPrice(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const deleted = await this.assetPriceService.deleteAssetPrice(uuid);
      if (!deleted) {
        return res.status(404).json({ message: "Asset price not found" });
      }
      return res.status(200).json({ message: "Asset price deleted successfully" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default AssetPriceController;
