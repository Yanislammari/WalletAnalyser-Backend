import { Request, Response } from "express";
import { AssetClusterService } from "../services/asset/asset_cluster.service";

class AssetClusterController {
  private readonly assetClusterService: AssetClusterService;

  constructor() {
    this.assetClusterService = new AssetClusterService();
  }

  public async getAll(req: Request, res: Response): Promise<Response> {
    return res
    /**try {
      const user_id = (req as any).user.id
      const response = await this.badgeService.getAllBadges(user_id);
      return res.status(200).json(response);
    }
    catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" });
    }**/
  }
}

export default AssetClusterController;
