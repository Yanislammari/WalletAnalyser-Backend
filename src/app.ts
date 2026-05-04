import { AzureAppInsightsService } from "./services/azure.app.insights.service";
import express, { Router, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { startOfDatabase } from "./config";
import { ExcelService, AuthService } from "./services";
import { UserRepository } from "./repositories";
import AuthRoutes from "./routes/auth.routes";
import PortfolioRoutes from "./routes/portfolio.routes";
import CurrencyRoutes from "./routes/currency.routes";
import AdminRoutes from "./routes/admin/admin.route";

AzureAppInsightsService.init();

dotenv.config();
const FRONTEND_ADDRESS = JSON.parse(process.env.FRONTEND_ADDRESS || "[]") as string[];

const app = express();

async function setUpApi() {
  const authService = new AuthService();
  await startOfDatabase();

  const excelService = new ExcelService();
  await excelService.addDataFromAdmin();
  authService.registerAdmin({
    email: "alexisduplessis2003@gmail.com",
    password: "MoiMeme94@",
    firstName: "Admin",
    lastName: "Admin",
  })
}

setUpApi();

app.use(
  cors({
    origin: FRONTEND_ADDRESS,
    methods: ["GET", "POST", "PATCH","PUT", "DELETE"],
  })
);

app.use(express.json());

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
app.use("/portfolio", PortfolioRoutes());
app.use("/currency", CurrencyRoutes());
app.use("/admin", AdminRoutes());

export default app;
