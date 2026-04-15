import "dotenv/config";
import { PrismaClient } from "@prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { isProd } from "../utils/constants";
import fs from "fs";

console.log(
  isProd ? "Running in production mode" : "Running in development mode",
);
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: isProd
    ? {
        ca: fs.readFileSync("certs/supabase-ca.crt", "utf-8"),
        rejectUnauthorized: true,
      }
    : false,
});

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
