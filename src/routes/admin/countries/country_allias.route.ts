import { Router } from "express";
import CountryAlliasController from "../../../controllers/countries/country_allias.controller";

const CountryAlliasAdminRoutes = (): Router => {
  const router: Router = Router();
  const countryAlliasController = new CountryAlliasController();

  router.get("/:country_uuid", (req, res) => countryAlliasController.getCountryAllias(req, res));
  router.post("/:country_uuid", (req, res) => countryAlliasController.createCountryAllias(req, res));
  router.patch("/:uuid", (req, res) => countryAlliasController.updateCountryAllias(req, res));
  router.delete("/:uuid", (req, res) => countryAlliasController.deleteCountryAllias(req, res));
  return router;
};

export default CountryAlliasAdminRoutes;