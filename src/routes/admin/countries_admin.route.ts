import { Router } from "express";
import CountryController from "../../controllers/countries.controller";

const CountriesAdminRoutes = (): Router => {
  const router: Router = Router();
  const countriesController = new CountryController();

  router.get("/",(req,res) => countriesController.getCountries(req,res))
  router.post("/",(req,res) => countriesController.createCountry(req,res))
  router.patch("/:uuid",(req,res) => countriesController.updateCountry(req,res))
  router.delete("/:uuid",(req,res) => countriesController.deleteCountry(req,res))
  return router;
};

export default CountriesAdminRoutes;