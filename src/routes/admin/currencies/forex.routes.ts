import { Router } from "express";
import ForexController from "../../../controllers/currencies/forex.controller";
import { upload } from "../../../app";


const ForexAdminRoutes = (): Router => {
  const router: Router = Router();
  const forexController = new ForexController();

  router.get("/", (req, res ) => forexController.getAllForex(req , res));
  router.post("/", upload.single("file"), (req, res ) =>  forexController.createForex(req, res));
  router.patch("/:uuid", (req, res ) => forexController.updateForex(req, res));
  router.delete("/:uuid", (req, res ) =>  forexController.deleteForex(req, res));
  return router;
};

export default ForexAdminRoutes;