import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { startOfDatabase } from "./config";
import { ExcelService } from "./services";

dotenv.config();
const FRONTEND_ADDRESS = process.env.FRONTEND_ADDRESS as string;

const app = express();

async function setUpApi() {
  await startOfDatabase();

  const excelService = new ExcelService();
  await excelService.addDataFromAdmin();
}

setUpApi();

app.use(
  cors({
    origin: FRONTEND_ADDRESS,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());

app.get("/", (_, res) => {
  res.send("PA : WalletAnalyser Backend");
});

app.use((err: unknown, _: Request, res: Response) => {
  console.error(err);

  if (err instanceof Error) {
    return res.status(500).json({
      message: err.message,
    });
  }

  return res.status(500).json({
    message: "Internal Server Error",
  });
});

export default app;
