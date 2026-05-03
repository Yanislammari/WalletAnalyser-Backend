import { Router } from "express";
import PortfolioController from "../controllers/portfolio.controller";

const PortfolioRoutes = (): Router => {
  const router: Router = Router();
  const portfolioController = new PortfolioController();

  router.post("/", (req, res) => portfolioController.createPortfolio(req, res));
  router.get("/user/:userId", (req, res) => portfolioController.getPortfoliosByUserId(req, res));
  router.get("/:portfolioId", (req, res) => portfolioController.getPortfolioById(req, res));
  router.get("/:portfolioId/asset-count", (req, res) => portfolioController.getAssetCountByPortfolioId(req, res));
  router.get("/:portfolioId/companies", (req, res) => portfolioController.getCompaniesByPortfolioId(req, res));
  router.get("/:portfolioId/buys", (req, res) => portfolioController.getBuysByPortfolioId(req, res));
  router.post("/:portfolioId/buys", (req, res) => portfolioController.addAssetBuy(req, res));
  router.get("/:portfolioId/sells", (req, res) => portfolioController.getSellsByPortfolioId(req, res));
  router.post("/:portfolioId/sells", (req, res) => portfolioController.addAssetSell(req, res));
  router.get("/:portfolioId/dividends", (req, res) => portfolioController.getDividendsByPortfolioId(req, res));
  router.post("/:portfolioId/dividends", (req, res) => portfolioController.addAssetDividend(req, res));
  router.delete("/:portfolioId", (req, res) => portfolioController.deletePortfolio(req, res));
  router.delete("/:portfolioId/buys/:buyId", (req, res) => portfolioController.deleteAssetBuy(req, res));
  router.delete("/:portfolioId/sells/:sellId", (req, res) => portfolioController.deleteAssetSell(req, res));
  router.delete("/:portfolioId/dividends/:dividendId", (req, res) => portfolioController.deleteAssetDividend(req, res));

  return router;
};

export default PortfolioRoutes;
