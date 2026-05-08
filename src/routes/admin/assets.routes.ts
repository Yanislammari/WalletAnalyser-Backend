import { Router } from "express";
import AssetController from "../../controllers/asset.controller";

const AssetAdminRoutes = (): Router => {
  const router: Router = Router();
  const assetController = new AssetController();

  router.get("/", (req, res) => assetController.getAllAssets(req, res));
  router.post("/", (req, res) => assetController.createAsset(req, res));
  router.patch("/:uuid", (req, res) => assetController.updateAsset(req, res));
  router.delete("/:uuid", (req, res) => assetController.deleteAsset(req, res));

  return router;
};

export default AssetAdminRoutes;
