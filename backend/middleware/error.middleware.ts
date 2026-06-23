import { Request, Response, NextFunction } from "express";
import { ErrorHandler } from "../utils/errorHandler";
import { NODE_ENV } from "../utils/constants";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorMiddleware = (
  err: Error | ErrorHandler,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";

  if (err instanceof ErrorHandler) {
    statusCode = err.statusCode;
    message = err.message;
  } else {
    if (NODE_ENV !== "production") {
      console.error("UNEXPECTED ERROR:", err);
    }
  }

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
