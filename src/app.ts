import { AzureAppInsightsService } from "./services/azure.app.insights.service";
import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { startOfDatabase } from "./config";
import { ExcelService, AuthService } from "./services";
import { AssetBaseCurrencySyncService } from "./services/asset.base.currency.sync.service";
import { StartupSyncService } from "./services/startup/startup.sync.service";
import AuthRoutes from "./routes/auth.routes";
import SubscriptionRoutes from "./routes/subscription.routes";
import PortfolioRoutes from "./routes/portfolio.routes";
import CurrencyRoutes from "./routes/currency.routes";
import AdminRoutes from "./routes/admin/admin.route";
import ImportRoutes from "./routes/import.routes";
import AssetRoutes from "./routes/asset.routes";
import SectorsRoutes from "./routes/sectors.routes";
import CountriesRoutes from "./routes/countries.routes";
import multer from "multer";
import { BadgeService } from "./services/badge.service";
import BadgeRoutes from "./routes/badge.routes";
import { createVerifyTokenAdminMiddleware, createVerifyTokenMiddleware } from "./middleware/token";
import ClusterRoutes from "./routes/asset_cluster.routes";
import { PYTHON_BASE_URL } from "./constants/env";
import { AssetClusterRepository } from "./repositories/asset/asset_cluster.repository";

AzureAppInsightsService.init();

dotenv.config();
const FRONTEND_ADDRESS = JSON.parse(process.env.FRONTEND_ADDRESS || "[]") as string[];

const app = express();

async function setUpApi() {
  await startOfDatabase();
  const authService = new AuthService();
  authService.registerAdmin({
    email: "alexisduplessis2003@gmail.com",
    password: "MoiMeme94@",
    firstName: "Admin",
    lastName: "Admin",
  });
  const badgeService = new BadgeService();
  await badgeService.createAllBadges()
  const excelService = new ExcelService();
  await excelService.addDataFromAdmin();

  const assetClusterRepository = new AssetClusterRepository();
  const clusters = await assetClusterRepository.get()
  if(clusters.length == 0){
    console.log("No clusters found, creating prod model...")
    //fetch(`${PYTHON_BASE_URL}create-prod-model`)
  }

  const assetBaseCurrencySyncService = new AssetBaseCurrencySyncService();
  await assetBaseCurrencySyncService.syncBaseCurrencies();

  // Fire-and-forget background sync (forex rates + dividends for 5 years)
  const startupSyncService = new StartupSyncService();
  startupSyncService.syncAll().catch((err) => {
    console.error("[StartupSync] Unhandled error:", err instanceof Error ? err.message : String(err));
  });
}

setUpApi();

app.use(
  cors({
    origin: FRONTEND_ADDRESS,
    methods: ["GET", "POST", "PATCH","PUT", "DELETE"],
  })
);

// Stripe webhook must receive raw body — mount BEFORE express.json()
app.use("/subscription/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const imagesPath = path.join(__dirname, "asset", "images");
app.use("/images",createVerifyTokenMiddleware(), express.static(imagesPath));

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

app.get("/", (_, res) => {
  res.send("PA : WalletAnalyser Backend");
});

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

app.use("/auth", AuthRoutes());
app.use("/subscription", SubscriptionRoutes());
app.use("/sector",SectorsRoutes());
app.use("/country",CountriesRoutes());
app.use("/portfolio", PortfolioRoutes());
app.use("/currency", CurrencyRoutes());
app.use("/badges", BadgeRoutes());
app.use("/clusters", createVerifyTokenMiddleware(), ClusterRoutes());
app.use("/admin", AdminRoutes());
app.use("/import", createVerifyTokenMiddleware(), ImportRoutes());
app.use("/asset", createVerifyTokenMiddleware(), AssetRoutes());

export default app;
