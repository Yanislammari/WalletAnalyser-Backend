import { Router } from "express";
import UserRoutes from "./user.routes";
import { createVerifyTokenAdminMiddleware } from "../../middleware/token";
import SectorsAdminRoutes from "./sector/sector_admin.route";
import CountriesAdminRoutes from "./countries/countries_admin.route";
import SectorAlliasAdminRoutes from "./sector/sector_allias.route";
import CountryAlliasAdminRoutes from "./countries/country_allias.route";
import RfrCountryAdminRoutes from "./rfr/rfr_country.routes";
import RfrRatesAdminRoutes from "./rfr/rfr_rates.routes";
import ForexAdminRoutes from "./currencies/forex.routes";
import ForexRatesAdminRoutes from "./currencies/forex_rates.routes";
import CurrenciesAdminRoutes from "./currencies/currencies_admin.route";

const AdminRoutes = (): Router => {
  const router: Router = Router();
  
  router.use("/users",createVerifyTokenAdminMiddleware(),UserRoutes())
  router.use("/sector",createVerifyTokenAdminMiddleware(),SectorsAdminRoutes())
  router.use("/country",createVerifyTokenAdminMiddleware(),CountriesAdminRoutes())
  router.use("/sector-allias",createVerifyTokenAdminMiddleware(),SectorAlliasAdminRoutes())
  router.use("/country-allias",createVerifyTokenAdminMiddleware(),CountryAlliasAdminRoutes())
  router.use("/rfr-country",createVerifyTokenAdminMiddleware(),RfrCountryAdminRoutes())
  router.use("/rfr-rates",createVerifyTokenAdminMiddleware(),RfrRatesAdminRoutes())
  router.use("/forex",createVerifyTokenAdminMiddleware(), ForexAdminRoutes())
  router.use("/forex-rates",createVerifyTokenAdminMiddleware(), ForexRatesAdminRoutes())
  router.use("/currencies",createVerifyTokenAdminMiddleware(), CurrenciesAdminRoutes())
  return router;
};

export default AdminRoutes;
