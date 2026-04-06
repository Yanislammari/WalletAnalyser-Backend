import dotenv from "dotenv";
import { requireEnv } from "../config/require_env";

dotenv.config();

export const PORT: string = requireEnv("PORT");
export const FRONTEND_ADDRESS: string = requireEnv("FRONTEND_ADDRESS");
export const DATABASE_URL: string = requireEnv("DATABASE_URL");
export const SECRET_KEY: string = requireEnv("SECRET_KEY");
