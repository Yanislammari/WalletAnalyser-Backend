import { Router } from "express";
import CurrenciesController from "../../../controllers/currencies/currencies.controller";

const CurrenciesAdminRoutes = (): Router => {
  const router: Router = Router();
  const currenciesController = new CurrenciesController();

  router.get("/",(req,res) => currenciesController.getCurrencies(req,res))
  router.post("/",(req,res) => currenciesController.createCurrency(req,res))
  router.patch("/:uuid",(req,res) => currenciesController.updateCurrency(req,res))
  router.delete("/:uuid",(req,res) => currenciesController.deleteCurrency(req,res))
  return router;
};

export default CurrenciesAdminRoutes;