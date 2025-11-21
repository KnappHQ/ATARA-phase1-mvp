import { Router } from "express";
import { query } from "../config/db";

const router = Router();

// Backend-only health
router.get("/", (req, res) => {
  return res.json({
    status: "active",
    message: "KNAPP Backend is running",
  });
});

// DB health
router.get("/db", async (req, res) => {
  try {
    await query("SELECT NOW()");
    return res.json({
      db_status: "connected",
    });
  } catch (error) {
    console.error("DB Health Error:", error);
    return res.status(500).json({
      db_status: "disconnected",
      error: "Database connection failed",
    });
  }
});

export default router;
