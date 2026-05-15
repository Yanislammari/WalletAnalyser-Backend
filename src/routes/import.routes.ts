import { Router } from "express";
import ImportController from "../controllers/import.controller";

const ImportRoutes = (): Router => {
  const router: Router = Router();
  const importController = new ImportController();

  router.get("/template/:format", (req, res) => importController.downloadTemplate(req, res));

  return router;
};

export default ImportRoutes;
