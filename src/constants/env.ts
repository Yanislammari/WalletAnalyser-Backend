import dotenv from "dotenv";
import { requireEnv } from "../config/require_env";

dotenv.config();

export const PORT: string = requireEnv("PORT");
export const FRONTEND_ADDRESS: string = requireEnv("FRONTEND_ADDRESS");
export const DATABASE_URL: string = requireEnv("DATABASE_URL");
export const SECRET_KEY: string = requireEnv("SECRET_KEY");
export const OAUTH_CLIENT_ID: string = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
export const MJ_API_KEY: string = requireEnv("MJ_API_KEY");
export const MJ_API_SECRET: string = requireEnv("MJ_API_SECRET");
export const MJ_SENDER: string = requireEnv("MJ_SENDER");
export const AZURE_BLOB_STORAGE_CONNECTION_STRING: string = requireEnv("AZURE_BLOB_STORAGE_CONNECTION_STRING");
export const AZURE_BLOB_STORAGE_CONTAINER_NAME_TEMPLATES: string = requireEnv("AZURE_BLOB_STORAGE_CONTAINER_NAME_TEMPLATES");
export const AZURE_BLOB_STORAGE_CONTAINER_NAME_UPLOADS: string = requireEnv("AZURE_BLOB_STORAGE_CONTAINER_NAME_UPLOADS");
export const FRONTEND_URL_PROD: string = requireEnv("FRONTEND_URL_PROD");
