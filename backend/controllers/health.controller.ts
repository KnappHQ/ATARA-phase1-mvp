import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import prisma from "../config/prisma";
import { NODE_ENV, NETWORK } from "../utils/constants";

export const healthController = {
  backendHealth: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      res.status(200).json({
        status: "success",
        message: "Backend is healthy",
        chainId: NETWORK === "base-mainnet" ? 8453 : 84532,
        network: NETWORK,
      });
    },
  ),

  dbHealth: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await prisma.$queryRaw`SELECT NOW()`;

        return res.json({
          db_status: "connected",
        });
      } catch (error) {
        if (NODE_ENV !== "production") {
          console.error("DB Health Error:", error);
        }

        return res.status(500).json({
          db_status: "disconnected",
          error: "Database connection failed",
        });
      }
    },
  ),
};
