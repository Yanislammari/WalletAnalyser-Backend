import { Router } from "express";
import SectorController from "../../controllers/sectors.controller";

const SectorsAdminRoutes = (): Router => {
  const router: Router = Router();
  const sectorsController = new SectorController();

  router.get("/",(req,res) => sectorsController.getSectors(req,res))
  router.post("/",(req,res) => sectorsController.createSector(req,res))
  router.patch("/:uuid",(req,res) => sectorsController.updateSector(req,res))
  router.delete("/:uuid",(req,res) => sectorsController.deleteSector(req,res))
  return router;
};

export default SectorsAdminRoutes;
