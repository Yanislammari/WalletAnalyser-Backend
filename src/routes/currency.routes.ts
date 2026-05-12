import { Router } from "express";
import CurrencyController from "../controllers/currency.controller";

const CurrencyRoutes = (): Router => {
  const router: Router = Router();
  const currencyController = new CurrencyController();

  router.get("/", (req, res) => currencyController.getAll(req, res));
  router.get("/:name", (req, res) => currencyController.getByName(req, res));

  return router;
};

export default CurrencyRoutes;
