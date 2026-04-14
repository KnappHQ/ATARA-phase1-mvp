import "dotenv/config";
import { PrismaClient } from "@prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: {
    rejectUnauthorized: false,
  },
});

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
