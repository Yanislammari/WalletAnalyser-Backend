import { Request, Response } from "express";
import { AssetService } from "../services/asset/asset.service";
import { EtfService } from '../services/asset/etf_service';
import { AssetDatabaseModel } from "../models";
import { EtfPatchAssetPayload, EtfPostHolding } from "../dtos";
import path from "path";
import fs from "fs"

class AssetController {
  private readonly assetService: AssetService;
  private readonly etfService : EtfService;

  constructor() {
    this.assetService = new AssetService();
    this.etfService = new  EtfService();
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

  public async getEtfHoldingPaginated(req : Request, res : Response): Promise<Response> {
    try {
      const etf_uuid = req.params.etf_uuid as string
      const limit = Number(req.query.limit) || 100;
      const offset = Number(req.query.offset) || 0;
      const search = req.query.search as string | undefined;  
      const response = await this.etfService.getEtfPaginated(etf_uuid, offset, limit, search);
      return res.status(200).json(response);
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getEtfHoldingMetaData(req : Request, res : Response): Promise<Response> {
    try {
      const etf_uuid = req.params.etf_uuid as string
      const response = await this.etfService.getConcentrationETF(etf_uuid);
      return res.status(200).json(response);
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getExcelTemplate(req : Request, res : Response):  Promise<void | Response> {
    try {
      const filePath = path.join(
        process.cwd(),
        "src/asset/json/IVV_holdings.json"
      );
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({message: "File not found"});
      }
      res.download(filePath, "forex_template.xlsx");
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateEtfConcentration(req : Request, res : Response): Promise<Response> {
    try {
      const payload = req.body as string
      const etf_uuid = req.params.etf_uuid as string
      const response = await this.etfService.updateAllEtfHolding(payload, etf_uuid)
      return res.status(200).json(response)
    } catch (error) {
      if(error instanceof Error && error.message.includes("Cannot read properties of undefined")) {
        return res.status(500).json({ message : "Wrong format please refer to the json exemple"})
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async addEtfHolding(req: Request, res : Response): Promise<Response> {
    try {
      const etf_uuid = req.params.etf_uuid as string;
      const payload = req.body as EtfPostHolding; 
      const updatedAsset = await this.etfService.postEtfHolding(payload, etf_uuid);
      if (!updatedAsset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      return res.status(200).json(updatedAsset);
    } catch (error) {
      if(error instanceof Error && error.message == "ABOVE_100"){
        return res.status(500).json({message : "This value is too high and put the total above 100%"})
      }
      if(error instanceof Error && error.message == "ALREADY_IN_ETF"){
        return res.status(500).json({message : "This value is already in the etf"})
      }
      if( error instanceof Error && error.message == "ASSET_IS_ETF") {
        return res.status(500).json({ message: "This asset is an ETF and cannot be added" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteEtfHolding(req : Request, res : Response): Promise<Response> {
    try {
      const etf_holdings_uuid = req.params.etf_holding_uuid as string;
      const response = await this.etfService.deleteEtfHolding(etf_holdings_uuid)
      return res.status(200).json({ message : "Holding deleted successfully"})
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async createAsset(req: Request, res: Response): Promise<Response> {
    try {
      const asset = new AssetDatabaseModel(
        req.body.official_name ?? null,
        req.body.ticker_name ?? null,
        req.body.type,
        req.body.sector_uuid ?? null,
        req.body.country_uuid ?? null,
        req.body.base_currency_uuid ?? null
      );

      const createdAsset = await this.assetService.createAsset(asset);
      return res.status(201).json(createdAsset);
    } catch (error) {
      if( error instanceof Error && error.message == "ALREADY_EXIST") {
        return res.status(500).json({ message: "This already exist in asset or etf" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateEtfHoldings(req: Request, res: Response): Promise<Response> {
    try {
      const etf_uuid = req.params.etf_uuid as string;
      const payload = req.body as EtfPatchAssetPayload; 
      const updatedAsset = await this.etfService.updateEtfHolding(payload, etf_uuid);
      if (!updatedAsset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      return res.status(200).json(updatedAsset);
    } catch (error) {
      if(error instanceof Error && error.message == "ABOVE_100"){
        return res.status(500).json({message : "This value is too high and put the total above 100%"})
      }
      if(error instanceof Error && error.message == "ASSET_IS_ETF") {
        return res.status(500).json({message : "This asset is an etf and cannot be modify"})
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async updateAsset(req: Request, res: Response): Promise<Response> {
    try {
      const uuid = req.params.uuid as string;
      const asset = new AssetDatabaseModel(
        req.body.official_name ?? null,
        req.body.ticker_name ?? null,
        req.body.type,
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
      if( error instanceof Error && error.message == "ALREADY_EXIST") {
        return res.status(500).json({ message: "This already exist in asset or etf" });
      }
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
