import { Request, Response, NextFunction } from "express";
import { ErrorHandler } from "../utils/errorHandler";
import { NODE_ENV } from "../utils/constants";
import { logError, redactPath } from "../utils/logger";

/**
 * Reasons for the client errors Express middleware raises before any of our own
 * code runs - body-parser's oversized or malformed payloads, chiefly.
 *
 * The error's own message is never forwarded: it comes from a third-party
 * library and may describe internals. Only the status is trusted.
 */
const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  400: "Malformed request",
  413: "Request body too large",
  415: "Unsupported content type",
};

/** The status a library error carries, when it is a client error. */
const clientErrorStatus = (err: unknown): number | null => {
  const status = (err as { status?: unknown; statusCode?: unknown }) ?? {};
  const value =
    typeof status.status === "number"
      ? status.status
      : typeof status.statusCode === "number"
        ? status.statusCode
        : null;

  return value !== null && value >= 400 && value <= 499 ? value : null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorMiddleware = (
  err: Error | ErrorHandler,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";

  const libraryClientStatus = clientErrorStatus(err);

  if (err instanceof ErrorHandler) {
    // Expected refusals - a 400, a 403, a 409. Not worth a log line.
    statusCode = err.statusCode;
    message = err.message;
  } else if (libraryClientStatus !== null) {
    // The caller sent something Express refused before reaching our code - an
    // oversized body, unparseable JSON. Answering 500 would blame the server
    // for the client's request, and fill the log with entries no one can act on.
    statusCode = libraryClientStatus;
    message = CLIENT_ERROR_MESSAGES[libraryClientStatus] ?? "Request rejected";
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
