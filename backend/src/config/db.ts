import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false
        }
      : false
});

pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL error:",
    error.message
  );
});

export default pool;