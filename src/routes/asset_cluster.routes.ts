import { Router } from "express";
import { createVerifyTokenMiddleware } from "../middleware/token";
import AssetClusterController from "../controllers/asset_cluster.controller";

const ClusterRoutes = (): Router => {
  const router: Router = Router();
  const assetClusterController = new AssetClusterController();

  router.get("/",createVerifyTokenMiddleware(),async (req, res) => assetClusterController.getAll(req, res));

  return router;
};

export default ClusterRoutes;
