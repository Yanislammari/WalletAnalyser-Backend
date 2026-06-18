import { Request, Response } from "express";
import { AssetClusterService } from "../services/asset/asset_cluster.service";

class AssetClusterController {
  private readonly assetClusterService: AssetClusterService;

  constructor() {
    this.assetClusterService = new AssetClusterService();
  }

  public async getSectorSummary(req: Request, res: Response): Promise<Response> {
    try {
      const response = await this.assetClusterService.getSectorSummary();
      return res.status(200).json({sectorsData : response});
    }
    catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getClusterSummary(req: Request, res : Response): Promise<Response> {
    try {
      const response = await this.assetClusterService.getClusterSummary();
      return res.status(200).json({sectorsData : response});
    }
    catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getUserStocksSummary(req : Request, res : Response): Promise<Response> {
    try {
      const { portfolio_id } = req.params;
      let response = {}
      if(portfolio_id){
        response = await this.assetClusterService.getUserStocksSummary(portfolio_id as string);
      }
      return res.status(200).json({sectorsData : response});
    }
    catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getSectorsDetails(req : Request, res : Response): Promise<Response> {
    try {
      const type = req.query.type as string;
      const sector_uuid = req.query.sector_uuid as string;
      let response;
      if(type == 'sector'){
        response = await this.assetClusterService.getSectorDetails(sector_uuid)
      } else if(type == 'cluster'){
        response = await this.assetClusterService.getClusterDetails(sector_uuid)
      } else {
        throw Error("NO_TYPE")
      }
      return res.status(200).json({sectorsData : response});
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getSectorName(req : Request, res : Response): Promise<Response> {
    try {
      const sector_uuid = req.params.sector_uuid as string;
      const response = await this.assetClusterService.getSectorName(sector_uuid)
      return res.status(200).json({sectorName : response});
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default AssetClusterController;
