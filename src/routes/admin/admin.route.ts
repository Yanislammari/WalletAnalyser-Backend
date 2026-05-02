import { Router } from "express";
import UserRoutes from "./user.routes";
import { createVerifyTokenAdminMiddleware } from "../../middleware/token";
import SectorsAdminRoutes from "./sector/sector_admin.route";
import CountriesAdminRoutes from "./countries/countries_admin.route";
import SectorAlliasAdminRoutes from "./sector/sector_allias.route";
import CountryAlliasAdminRoutes from "./countries/country_allias.route";
import RfrCountryAdminRoutes from "./rfr/rfr_country.routes";
import RfrRatesAdminRoutes from "./rfr/rfr_rates.routes";

const AdminRoutes = (): Router => {
  const router: Router = Router();
  
  router.use("/users",createVerifyTokenAdminMiddleware(),UserRoutes())
  router.use("/sector",createVerifyTokenAdminMiddleware(),SectorsAdminRoutes())
  router.use("/country",createVerifyTokenAdminMiddleware(),CountriesAdminRoutes())
  router.use("/sector-allias",createVerifyTokenAdminMiddleware(),SectorAlliasAdminRoutes())
  router.use("/country-allias",createVerifyTokenAdminMiddleware(),CountryAlliasAdminRoutes())
  router.use("/rfr-country",createVerifyTokenAdminMiddleware(),RfrCountryAdminRoutes())
  router.use("/rfr-rates",createVerifyTokenAdminMiddleware(),RfrRatesAdminRoutes())
  return router;
};

export default AdminRoutes;
