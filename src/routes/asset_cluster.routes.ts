import { Router } from "express";
import AssetClusterController from "../controllers/asset_cluster.controller";

const ClusterRoutes = (): Router => {
  const router: Router = Router();
  const assetClusterController = new AssetClusterController();

  router.get("/sectors",async (req, res) => assetClusterController.getSectorSummary(req, res));
  router.get("/clusters",async (req, res) => assetClusterController.getClusterSummary(req, res));
  router.get("/countries",async (req, res) => assetClusterController.getCountriesSummary(req,res))
  router.get("/user_stocks/:portfolio_id", async (req, res) => assetClusterController.getUserStocksSummary(req , res));
  router.get("/sector_detail", async(req, res) => assetClusterController.getGlobalRankingType(req,res))
  router.get("/name/:sector_uuid", async(req, res) => assetClusterController.getSectorName(req,res))
  router.get("/country_name/:country_uuid", async(req, res) => assetClusterController.getCountryName(req,res))

  return router;
};

export default ClusterRoutes;
