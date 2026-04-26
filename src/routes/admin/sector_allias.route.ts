import { Router } from "express";
import SectorAlliasController from "../../controllers/sector_allias.controller";

const SectorAlliasAdminRoutes = (): Router => {
  const router: Router = Router();
  const sectorAlliasController = new SectorAlliasController();

  router.get("/:sector_uuid", (req, res) => sectorAlliasController.getSectorAllias(req, res));
  router.post("/:sector_uuid", (req, res) => sectorAlliasController.createSectorAllias(req, res));
  router.patch("/:uuid", (req, res) => sectorAlliasController.updateSectorAllias(req, res));
  router.delete("/:uuid", (req, res) => sectorAlliasController.deleteSectorAllias(req, res));
  return router;
};

export default SectorAlliasAdminRoutes;