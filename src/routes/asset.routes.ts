import { Router } from "express";
import AssetController from "../controllers/asset.controller";

const AssetRoutes = (): Router => {
  const router: Router = Router();
  const assetController = new AssetController();

  router.get("/", (req, res) => assetController.getAll(req, res));
  router.get("/:assetId/price", (req, res) => assetController.getPrice(req, res));

  return router;
};

export default AssetRoutes;
