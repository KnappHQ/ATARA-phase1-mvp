import "dotenv/config";
import { PrismaClient } from "@prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { isProd } from "../utils/constants";
import fs from "fs";

if (!isProd) {
  console.log("Running in development mode");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing required environment variable DATABASE_URL");
}

const caPath = process.env.DATABASE_SSL_CA_PATH;
const useSsl = process.env.DATABASE_SSL === "true";

const ssl = caPath
  ? {
      ca: fs.readFileSync(caPath, "utf-8"),
      rejectUnauthorized: true,
    }
  : useSsl
    ? { rejectUnauthorized: false }
    : false;

const adapter = new PrismaPg({
  connectionString,
  ssl,
});

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
