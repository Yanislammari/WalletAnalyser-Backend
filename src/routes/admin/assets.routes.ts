import { Router } from "express";
import AssetController from "../../controllers/asset.controller";

const AssetAdminRoutes = (): Router => {
  const router: Router = Router();
  const assetController = new AssetController();

  router.get("/etf-assets/:etf_uuid", (req,res) => assetController.getEtfHoldingPaginated(req,res))
  router.get("/etf-holdings/:etf_uuid", (req, res) => assetController.getEtfHoldingMetaData(req,res))
  router.get("/excel-template", (req, res) => assetController.getExcelTemplate(req, res));
  router.patch("/etf-holdings/:etf_uuid", (req, res) => assetController.updateEtfHoldings(req,res))
  router.post("/etf-assets/:etf_uuid", ( req,res) => assetController.addEtfHolding(req,res))
  router.patch("/etf-concentration/:etf_uuid", (req, res) => assetController.updateEtfConcentration(req,res))
  router.get("/", (req, res) => assetController.getAllAssets(req, res));
  router.post("/", (req, res) => assetController.createAsset(req, res));
  router.patch("/:uuid", (req, res) => assetController.updateAsset(req, res));
  router.delete("/:uuid", (req, res) => assetController.deleteAsset(req, res));
  router.delete("/etf-assets/:etf_holding_uuid", (req, res) => assetController.deleteEtfHolding(req,res))

  return router;
};

export default AssetAdminRoutes;
