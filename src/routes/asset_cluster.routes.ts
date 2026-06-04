import { Router } from "express";
import AssetClusterController from "../controllers/asset_cluster.controller";

const ClusterRoutes = (): Router => {
  const router: Router = Router();
  const assetClusterController = new AssetClusterController();

  router.get("/sectors",async (req, res) => assetClusterController.getSectorSummary(req, res));
  router.get("/clusters",async (req, res) => assetClusterController.getClusterSummary(req, res));

  return router;
};

export default ClusterRoutes;
