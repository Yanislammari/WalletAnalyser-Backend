import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { startOfDatabase } from "./config/db";

dotenv.config();
const FRONTEND_ADDRESS = process.env.FRONTEND_ADDRESS as string;

const app = express();
startOfDatabase();

app.use(cors({
  origin: FRONTEND_ADDRESS,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use(express.json());

app.get("/", (_, res) => {
  res.send("PA : WalletAnalyser Backend");
});

export default app;
