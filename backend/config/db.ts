import { Pool } from "pg";
import { DB_CONNECTION_STRING } from "../utils/constants";

// Check for connection string
if (!DB_CONNECTION_STRING) {
  console.error("FATAL: DATABASE_URL is not defined in .env");
  process.exit(1);
}

// Initialize Postgres Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Event listeners for logging
pool.on("connect", () => {
  console.log("Connected to the PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Export a query wrapper for cleaner async/await usage
export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
