import { Router } from "express";
import { createVerifyTokenMiddleware } from "../middleware/token";
import SectorController from "../controllers/sector/sectors.controller";

const SectorsRoutes = (): Router => {
  const router: Router = Router();
  const sectorsController = new SectorController();

  router.get("/",createVerifyTokenMiddleware(),(req,res) => sectorsController.getSectors(req,res))
  return router;
};

export default SectorsRoutes;
