import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";

  // Check if it's a trusted operational error (AppError)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else {
    // Log unknown errors (bugs) to console for debugging
    console.error("UNEXPECTED ERROR:", err);
  }

  // Send strict JSON response
  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
