import { Router } from "express";
import { createVerifyTokenMiddleware } from "../middleware/token";
import CountryController from "../controllers/countries/countries.controller";

const CountriesRoutes = (): Router => {
  const router: Router = Router();
  const countriesController = new CountryController();

  router.get("/",createVerifyTokenMiddleware(),(req,res) => countriesController.getCountries(req,res))
  return router;
};

export default CountriesRoutes;
