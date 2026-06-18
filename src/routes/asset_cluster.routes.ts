import { Router } from "express";
import AssetClusterController from "../controllers/asset_cluster.controller";

const ClusterRoutes = (): Router => {
  const router: Router = Router();
  const assetClusterController = new AssetClusterController();

  router.get("/sectors",async (req, res) => assetClusterController.getSectorSummary(req, res));
  router.get("/clusters",async (req, res) => assetClusterController.getClusterSummary(req, res));
  router.get("/user_stocks", async (req, res) => assetClusterController.getUserStocksSummary(req , res));
  router.get("/sector_detail", async(req, res) => assetClusterController.getSectorsDetails(req,res))
  router.get("/name/:sector_uuid", async(req, res) => assetClusterController.getSectorName(req,res))

  return router;
};

export default ClusterRoutes;
