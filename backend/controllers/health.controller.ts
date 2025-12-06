import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import prisma from "../config/prisma";

export const healthController = {
  backendHealth: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      res.status(200).json({
        status: "success",
        message: "Backend is healthy",
      });
    }
  ),

  dbHealth: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // The first query triggers a real DB connection
        await prisma.$queryRaw`SELECT NOW()`;

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
    }
  ),
};
