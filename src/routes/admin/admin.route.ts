import { Router } from "express";
import UserRoutes from "./user.routes";
import { createVerifyTokenAdminMiddleware } from "../../middleware/token";
import SectorsAdminRoutes from "./sector_admin.route";
import CountriesAdminRoutes from "./countries_admin.route";
import SectorAlliasAdminRoutes from "./sector_allias.route";
import CountryAlliasAdminRoutes from "./country_allias.route";

const AdminRoutes = (): Router => {
  const router: Router = Router();
  
  router.use("/users",createVerifyTokenAdminMiddleware(),UserRoutes())
  router.use("/sector",createVerifyTokenAdminMiddleware(),SectorsAdminRoutes())
  router.use("/country",createVerifyTokenAdminMiddleware(),CountriesAdminRoutes())
  router.use("/sector-allias",createVerifyTokenAdminMiddleware(),SectorAlliasAdminRoutes())
  router.use("/country-allias",createVerifyTokenAdminMiddleware(),CountryAlliasAdminRoutes())
  return router;
};

export default AdminRoutes;
