import { Request, Response, NextFunction } from "express";
import { ErrorHandler } from "../utils/errorHandler";
import { NODE_ENV } from "../utils/constants";
import { logError, redactPath } from "../utils/logger";

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
    // Expected refusals - a 400, a 403, a 409. Not worth a log line.
    statusCode = err.statusCode;
    message = err.message;
  } else {
    // Anything reaching here is a bug or an outage. Logged in production too:
    // the client only ever sees "Internal Server Error", so this is the sole
    // record that it happened.
    //
    // Method and path only - no headers, no body, no query string. The path
    // itself is redacted because /requests/pay/:token carries a secret.
    logError("unhandled_error", err, {
      method: req.method,
      path: redactPath(req.path),
    });
  }

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    stack: NODE_ENV === "development" ? err.stack : undefined,
  });
};
