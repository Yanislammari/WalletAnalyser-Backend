import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();
const DATABASE_URL = process.env.DATABASE_URL as string;

export const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  define: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  timezone: "-00:00",
  dialectOptions: {
    timezone: "Z",
    dateStrings: true,
  },
  logging: false,
  pool: {
    max: 10,    // was 3 — enough headroom for parallel Promise.all without exhausting DB connections
    min: 2,     // keep 2 connections alive to avoid reconnect latency on first request
    acquire: 30000,
    idle: 30000, // was 5000 — keep connections alive 30s to avoid SSL reconnect overhead (~50-100ms each)
  },
});

export async function startOfDatabase() {
  // sync({ force: false }) = CREATE TABLE IF NOT EXISTS only.
  // Does NOT inspect or alter existing columns — safe in prod, no connection spike.
  await sequelize
    .sync({ force: false })
    .then(() => {
      console.log("Database and tables have been synchronized");
    })
    .catch(err => {
      console.error("An error occurred while synchronizing the database:", err);
    });
}
