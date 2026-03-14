import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const FRONTEND_ADDRESS = process.env.FRONTEND_ADDRESS as string;

const app = express();

app.use(cors({
  origin: FRONTEND_ADDRESS,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use(express.json());

app.get("/", (_, res) => {
  res.send("PA : WalletAnalyser Backend");
});

export default app;
