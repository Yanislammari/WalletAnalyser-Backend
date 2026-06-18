import { Router } from "express";
import { createVerifyTokenMiddleware } from "../middleware/token";
import BadgeController from "../controllers/badge.controller";

const BadgeRoutes = (): Router => {
  const router: Router = Router();
  const badgeController = new BadgeController();

  router.get("/",createVerifyTokenMiddleware(),async (req, res) => badgeController.getAll(req, res));

  return router;
};

export default BadgeRoutes;
