import { Router } from "express";
import RfrRatesController from "../../../controllers/rfr/rfr_rates.controller";

const RfrRatesAdminRoutes = (): Router => {
  const router: Router = Router();
  const rfrRatesController = new RfrRatesController();

  router.get("/:rfr_country_uuid", (req, res) => rfrRatesController.getAllRfrRates(req, res));
  router.post("/:rfr_country_uuid", (req, res) => rfrRatesController.createRfrRate(req, res));
  router.patch("/:uuid", (req, res) => rfrRatesController.updateRfrRate(req, res));
  router.delete("/:uuid", (req, res) => rfrRatesController.deleteRfrRate(req, res));

  return router;
};

export default RfrRatesAdminRoutes;