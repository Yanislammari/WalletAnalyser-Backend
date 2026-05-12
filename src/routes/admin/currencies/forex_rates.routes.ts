import { Router } from "express";
import ForexRatesController from "../../../controllers/currencies/forex_rates.controller";

const ForexRatesAdminRoutes = (): Router => {
  const router: Router = Router();
  const forexRatesController = new ForexRatesController();

  router.get("/:forex_uuid", (req, res) => forexRatesController.getAllForexRates(req, res));
  router.post("/:forex_uuid", (req, res) => forexRatesController.createForexRate(req, res));
  router.patch("/:uuid", (req, res) => forexRatesController.updateForexRate(req, res));
  router.delete("/:uuid", (req, res) => forexRatesController.deleteForexRate(req, res));

  return router;
};

export default ForexRatesAdminRoutes;
