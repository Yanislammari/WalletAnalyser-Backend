import { Router } from "express";
import AssetController from "../controllers/asset.controller";

const AssetRoutes = (): Router => {
  const router: Router = Router();
  const assetController = new AssetController();

  router.get("/", (req, res) => assetController.getAll(req, res));
  router.get("/preview", (req, res) => assetController.previewCustomAsset(req, res));
  router.get("/benchmark", (req, res) => assetController.getBenchmarkHistory(req, res));
  // Must be registered before /:assetId so Express doesn't treat "search" as a UUID
  router.get("/search", (req, res) => assetController.searchAssets(req, res));
  router.post("/custom", (req, res) => assetController.createCustomAsset(req, res));
  router.get("/:assetId/price", (req, res) => assetController.getPrice(req, res));
  router.get("/:assetId", (req, res) => assetController.getAssetById(req, res));

  return router;
};

export default AssetRoutes;
