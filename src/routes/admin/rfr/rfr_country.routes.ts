import { Router } from "express";
import RfrCountryController from "../../../controllers/rfr/rfr_country.controller";
import { upload } from "../../../app";

const RfrCountryAdminRoutes = (): Router => {
  const router: Router = Router();
  const rfrCountryController = new RfrCountryController();

  router.get("/excel-template", (req, res) => rfrCountryController.getExcelTemplate(req, res));
  router.get("/", (req, res) => rfrCountryController.getAllRfrCountries(req, res));
  router.post("/",upload.single("file"), (req, res) => rfrCountryController.createRfrCountry(req, res));
  router.patch("/:uuid", (req, res) => rfrCountryController.updateRfrCountry(req, res));
  router.delete("/:uuid", (req, res) => rfrCountryController.deleteRfrCountry(req, res));

  return router;
};

export default RfrCountryAdminRoutes;