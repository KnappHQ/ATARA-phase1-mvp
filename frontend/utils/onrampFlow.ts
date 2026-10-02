import { classifyFailure, describeFailure, withTimeout } from "./loadState";

/**
 * The "buy crypto" flow, as a small state machine that cannot spin for ever.
 *
 *   idle -> creating -> open -> returned
 *               \-> failed        (from any step)
 *
 * Only `creating` is busy, and it has a hard deadline. `open` is NOT busy: the
 * browser is on top of the app and the person is free to come back whenever they
 * like, so nothing waits on the browser's own promise, which on iOS may never
 * settle if the checkout hands control back to the app through a link. Coming
 * back (the browser closing, or the app becoming active again) moves on by
 * itself, and the balance is refreshed a few times on a schedule, then left
 * alone: if MoonPay confirms later, Activity shows it.
 */

export type OnrampPhase = "idle" | "creating" | "open" | "returned" | "failed";

export interface OnrampState {
  phase: OnrampPhase;
  failure?: { message: string; code?: string };
}

export type OnrampEvent =
  | { type: "start" }
  | { type: "opened" }
  | { type: "returned" }
  | { type: "failed"; message: string; code?: string }
  | { type: "reset" };

export const INITIAL_ONRAMP: OnrampState = { phase: "idle" };

export const onrampReducer = (state: OnrampState, event: OnrampEvent): OnrampState => {
  switch (event.type) {
    case "start":
      // A second tap while a session is being prepared does nothing.
      return state.phase === "creating" ? state : { phase: "creating" };
    case "opened":
      return state.phase === "creating" ? { phase: "open" } : state;
    case "returned":
      return state.phase === "open" || state.phase === "creating" ? { phase: "returned" } : state;
    case "failed":
      return { phase: "failed", failure: { message: event.message, ...(event.code ? { code: event.code } : {}) } };
    case "reset":
      return INITIAL_ONRAMP;
  }
};

/** The only phase in which the screen shows a spinner. It always ends: see CREATE_SESSION_TIMEOUT_MS. */
export const isBusy = (state: OnrampState): boolean => state.phase === "creating";

export const CREATE_SESSION_TIMEOUT_MS = 15_000;
/** When to re-read the balance after coming back, in ms. Then it stops. */
export const BALANCE_REFRESH_SCHEDULE_MS = [0, 5_000, 15_000, 30_000] as const;

// ---------------------------------------------------------------------------
// The URL the backend hands out

export type CheckoutUrlCheck = { ok: true } | { ok: false; reason: "malformed" | "not-https" | "host" | "unsigned" | "unexpected" };

const URL_PARTS = /^https:\/\/([^/?#@:]+)(\/[^?#]*)?\?([^#\s]+)$/;

/**
 * Whether this is a URL the app should open: the beta's MoonPay sandbox, over
 * https, carrying a signature as its last parameter. It only LOOKS; it never
 * rebuilds or changes the URL, because anything changed after the server signed
 * it is exactly what makes MoonPay say "signature check failed".
 */
export const validateCheckoutUrl = (raw: unknown, expectedHost = "buy-sandbox.moonpay.com"): CheckoutUrlCheck => {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4000) return { ok: false, reason: "malformed" };
  if (!/^https:/i.test(raw)) return { ok: false, reason: /^[a-z][a-z0-9+.-]*:/i.test(raw) ? "not-https" : "malformed" };
  const match = raw.match(URL_PARTS);
  if (!match) return { ok: false, reason: "malformed" };
  if (match[1].toLowerCase() !== expectedHost) return { ok: false, reason: "host" };
  const params = match[3].split("&");
  const last = params[params.length - 1] ?? "";
  if (!last.startsWith("signature=") || last.length <= "signature=".length) return { ok: false, reason: "unsigned" };
  if (params.filter((param) => param.startsWith("signature=")).length !== 1) return { ok: false, reason: "unexpected" };
  if (!params.some((param) => param.startsWith("apiKey=")) || !params.some((param) => param.startsWith("walletAddress="))) {
    return { ok: false, reason: "unexpected" };
  }
  return { ok: true };
};

// ---------------------------------------------------------------------------
// What to tell the person

export interface OnrampFailure {
  message: string;
  code?: string;
}

const SERVER_CONFIG_MESSAGES = [
  "MoonPay keys do not match",
  "The on-ramp URL does not match",
  "The on-ramp is not configured correctly",
];

export const classifyOnrampError = (error: unknown): OnrampFailure => {
  const data = (error as { response?: { data?: { message?: unknown; code?: unknown } } } | null)?.response?.data;
  const serverMessage = typeof data?.message === "string" ? data.message : "";
  // A fixed diagnostic code from the server, e.g. "MP-SECRET-PREFIX". Shown as is.
  const code = typeof data?.code === "string" && /^MP-[A-Z0-9-]{3,40}$/.test(data.code) ? data.code : undefined;
  const kind = classifyFailure(error);

  if (serverMessage === "The on-ramp is not configured yet") {
    return { message: "MoonPay is not configured yet. To test ATARA, get test USDC from the Circle faucet above.", ...(code ? { code } : {}) };
  }
  if (SERVER_CONFIG_MESSAGES.some((known) => serverMessage.startsWith(known))) {
    return { message: "MoonPay is not set up correctly on our side, so nothing was opened. This is not a problem with your account.", ...(code ? { code } : {}) };
  }
  if (serverMessage === "Your smart account is not ready yet. Finish wallet setup first.") return { message: serverMessage };
  if (kind === "unknown" && serverMessage) return { message: serverMessage, ...(code ? { code } : {}) };
  return { message: `${describeFailure(kind)} Nothing was opened. Try again.`, ...(code ? { code } : {}) };
};

export const describeUrlProblem = (reason: Exclude<CheckoutUrlCheck, { ok: true }>["reason"]): OnrampFailure => ({
  message:
    reason === "host" || reason === "not-https"
      ? "The checkout address was not the expected MoonPay address, so it was not opened."
      : "The checkout address was not valid, so it was not opened.",
  code: `APP-CHECKOUT-${reason.toUpperCase()}`,
});

// ---------------------------------------------------------------------------
// Running it

export interface CheckoutDeps {
  createSession: (amount: string) => Promise<{ url: string; mode?: string }>;
  openBrowser: (url: string) => Promise<unknown>;
  createTimeoutMs?: number;
}

/**
 * Prepares a session, opens it, and reports each step. Resolves once the
 * browser has been handed back (or at once if nothing was opened); the screen
 * does not wait on this to show anything, because it has already been told
 * "opened" by then.
 */
export const runCheckout = async (
  deps: CheckoutDeps,
  amount: string,
  dispatch: (event: OnrampEvent) => void,
): Promise<void> => {
  dispatch({ type: "start" });
  let url: string;
  try {
    const session = await withTimeout(deps.createSession(amount), deps.createTimeoutMs ?? CREATE_SESSION_TIMEOUT_MS);
    if (session.mode !== undefined && session.mode !== "sandbox") {
      dispatch({ type: "failed", message: "Real purchases are not available in this beta yet.", code: "APP-CHECKOUT-LIVE" });
      return;
    }
    const check = validateCheckoutUrl(session.url);
    if (!check.ok) {
      const failure = describeUrlProblem(check.reason);
      dispatch({ type: "failed", ...failure });
      return;
    }
    url = session.url;
  } catch (error) {
    dispatch({ type: "failed", ...classifyOnrampError(error) });
    return;
  }

  dispatch({ type: "opened" });
  try {
    await deps.openBrowser(url);
    dispatch({ type: "returned" });
  } catch {
    dispatch({ type: "failed", message: "Could not open MoonPay. Try again.", code: "APP-BROWSER-OPEN" });
  }
};

/** Runs `refresh` on the schedule, ignoring its failures, and returns a function that cancels what is left. */
export const scheduleBalanceRefresh = (
  refresh: () => Promise<unknown> | void,
  timers: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
  schedule: readonly number[] = BALANCE_REFRESH_SCHEDULE_MS,
): (() => void) => {
  const handles = schedule.map((ms) =>
    timers.set(() => {
      try {
        void Promise.resolve(refresh()).catch(() => undefined);
      } catch {
        // A refresh that fails is simply tried again at the next step.
      }
    }, ms),
  );
  return () => handles.forEach((handle) => timers.clear(handle));
};
