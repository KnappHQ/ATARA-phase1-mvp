// Prisma CLI configuration.
// `prisma generate` does not need a live database, so allow builds to complete
// before DATABASE_URL is injected by the hosting environment. Migrations and
// runtime database access still require a real DATABASE_URL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://render-build:render-build@127.0.0.1:5432/render_build";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
