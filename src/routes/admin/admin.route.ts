import { Router } from "express";
import UserRoutes from "./user.routes";
import { createVerifyTokenAdminMiddleware } from "../../middleware/token";

const AdminRoutes = (): Router => {
  const router: Router = Router();
  
  router.use("/users",createVerifyTokenAdminMiddleware(),UserRoutes())

  return router;
};

export default AdminRoutes;
