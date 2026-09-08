import { NODE_ENV } from "./constants";

/**
 * One JSON line per event, on stderr.
 *
 * Until now the backend logged nothing in production: every `console.error`
 * sat behind `if (NODE_ENV !== "production")`, so a 500 reached the client as
 * "Internal Server Error" and left no trace at all on the server. Neither an
 * outage nor an attack in progress was diagnosable.
 *
 * Deliberately dependency-free. Adding a logging library is an infrastructure
 * decision; one line of JSON is enough for Render and for any collector that
 * reads stdio, and it can be replaced later without touching call sites.
 *
 * Callers pass the fields they want recorded. Nothing is ever derived from the
 * request object here, so a header, a body or a token cannot reach the log by
 * accident.
 */
/**
 * Strips secrets out of a request path before it is logged.
 *
 * `GET /api/v1/requests/pay/:token` carries a 64-hex payment request token in
 * the path itself, and that token is the only thing standing between a stranger
 * and the request's details. Any long hex run is replaced, which also covers a
 * transaction hash and an address.
 */
export const redactPath = (path: string): string =>
  path.replace(/(0x)?[0-9a-fA-F]{32,}/g, "[redacted]");

export const logError = (
  context: string,
  error: unknown,
  fields: Record<string, unknown> = {},
): void => {
  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    level: "error",
    context,
    ...fields,
  };

  if (error instanceof Error) {
    entry.error = error.name;
    entry.message = error.message;
    // A stack can carry file paths and, through an error message, values from
    // the failing call. Kept out of production logs.
    if (NODE_ENV !== "production") {
      entry.stack = error.stack;
    }
  } else {
    entry.error = "NonError";
    entry.message = String(error);
  }

  process.stderr.write(`${JSON.stringify(entry)}\n`);
};
