import express, { Request, Response } from "express";
import dotenv from "dotenv";
import pool from "./config/db";

dotenv.config();

const app = express();

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "EmailFlow API is running!"
  });
});

app.get("/test-db", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connected successfully!",
      time: result.rows[0].now
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      message: "Database connection failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});