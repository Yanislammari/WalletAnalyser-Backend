import { Router } from "express";
import multer from "multer";
import ImportController from "../controllers/import.controller";

// Multer configured to keep the file in memory (no disk writes)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only .csv files are accepted"));
    }
  },
});

const ImportRoutes = (): Router => {
  const router: Router = Router();
  const importController = new ImportController();

  // Download example template
  router.get("/template/:format", (req, res) => importController.downloadTemplate(req, res));

  // Upload & import a CSV file into a portfolio
  router.post(
    "/portfolio/:portfolioId/csv",
    csvUpload.single("file"),
    (req, res) => importController.importCsv(req, res)
  );

  // Get import history for a portfolio
  router.get(
    "/portfolio/:portfolioId/history",
    (req, res) => importController.getImportHistory(req, res)
  );

  return router;
};

export default ImportRoutes;
