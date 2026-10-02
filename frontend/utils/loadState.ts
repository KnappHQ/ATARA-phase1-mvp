/**
 * One way for a screen to say "this could not be loaded", so none of them can
 * end up blank.
 *
 * A screen that depends on the service renders its fixed content first and
 * layers the live data on top; when the data cannot be had, this says why in a
 * sentence the person can act on. The kinds are decided from what actually came
 * back (an HTTP status, no response at all, a timeout, a body that is not the
 * expected shape), never from the text of an error.
 */

export type FailureKind = "offline" | "timeout" | "not-found" | "unauthorized" | "server" | "invalid" | "unknown";

export class InvalidResponseError extends Error {
  constructor(what: string) {
    super(`Unexpected response for ${what}`);
    this.name = "InvalidResponseError";
  }
}

export class LoadTimeoutError extends Error {
  constructor(ms: number) {
    super(`Did not answer within ${ms} ms`);
    this.name = "LoadTimeoutError";
  }
}

export const classifyFailure = (error: unknown): FailureKind => {
  if (error instanceof InvalidResponseError) return "invalid";
  if (error instanceof LoadTimeoutError) return "timeout";
  const failure = error as { code?: string; response?: { status?: number }; request?: unknown; message?: string; name?: string } | null;
  const status = failure?.response?.status;
  if (typeof status === "number") {
    if (status === 404 || status === 405 || status === 501) return "not-found";
    if (status === 401 || status === 403) return "unauthorized";
    if (status >= 500) return "server";
    return "unknown";
  }
  if (failure?.code === "ECONNABORTED" || failure?.code === "ETIMEDOUT" || failure?.name === "TimeoutError") return "timeout";
  // No response at all: the request never got an answer.
  if (failure?.code === "ERR_NETWORK" || failure?.message === "Network Error" || failure?.request !== undefined) return "offline";
  return "unknown";
};

/** What to tell the person. Fixed sentences: nothing from the error itself. */
export const describeFailure = (kind: FailureKind): string => {
  switch (kind) {
    case "offline":
      return "You seem to be offline.";
    case "timeout":
      return "The service took too long to answer.";
    case "not-found":
      return "This part of the service is not available yet.";
    case "unauthorized":
      return "Your session needs to be refreshed. Sign in again.";
    case "server":
      return "The service had a problem.";
    case "invalid":
      return "The service sent something this version of the app does not understand.";
    default:
      return "Something went wrong.";
  }
};

/** Rejects if `promise` has not settled in `ms`. The late result is ignored. */
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LoadTimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

export type Loaded<T> =
  | { status: "ok"; data: T }
  | { status: "failed"; failure: FailureKind };

/** Runs a load with a hard deadline and turns any failure into a value. Never throws. */
export const settle = async <T>(load: () => Promise<T>, ms = 12_000): Promise<Loaded<T>> => {
  try {
    return { status: "ok", data: await withTimeout(load(), ms) };
  } catch (error) {
    return { status: "failed", failure: classifyFailure(error) };
  }
};
