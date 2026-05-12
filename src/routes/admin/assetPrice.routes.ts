import { Router } from "express";
import AssetPriceController from "../../controllers/asset_price.controller";

const AssetPriceAdminRoutes = (): Router => {
  const router: Router = Router();
  const assetPriceController = new AssetPriceController();

  router.get("/:asset_uuid", (req, res) => assetPriceController.getAllAssetPrices(req, res));
  router.patch("/:asset_uuid/price", (req, res) => assetPriceController.updateAssetPrices(req,res));
  router.post("/:asset_uuid", (req, res) => assetPriceController.createAssetPrice(req, res));
  router.patch("/:uuid", (req, res) => assetPriceController.updateAssetPrice(req, res));
  router.delete("/:uuid", (req, res) => assetPriceController.deleteAssetPrice(req, res));

  return router;
};

export default AssetPriceAdminRoutes;
