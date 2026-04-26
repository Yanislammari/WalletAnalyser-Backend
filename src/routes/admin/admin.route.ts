import { Router } from "express";
import UserRoutes from "./user.routes";
import { createVerifyTokenAdminMiddleware } from "../../middleware/token";
import SectorsAdminRoutes from "./sector_admin.route";

const AdminRoutes = (): Router => {
  const router: Router = Router();
  
  router.use("/users",createVerifyTokenAdminMiddleware(),UserRoutes())
  router.use("/sector",createVerifyTokenAdminMiddleware(),SectorsAdminRoutes())
  return router;
};

export default AdminRoutes;
