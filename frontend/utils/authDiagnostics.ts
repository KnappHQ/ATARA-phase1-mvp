/**
 * Turns an authentication failure into something the person reading it can act
 * on.
 *
 * Every sign-in path in this app depends on configuration that lives outside
 * the repository - Privy for passkey and social login, Reown for wallet-only,
 * the ATARA API for the registration that follows. When one of them refuses,
 * the SDK hands back a bare string ("Signup with passkey not allowed") that
 * says nothing about which of the three failed or what to change. On a store
 * build there is no console to dig further.
 *
 * These functions never invent a diagnosis. An error they do not recognise is
 * reported as-is, with the three places worth checking.
 */

export type AuthLayer = "privy" | "wallet" | "api" | "network" | "unknown";

export type AuthFailure = {
  /** Which system refused, as far as the error actually tells us. */
  layer: AuthLayer;
  /** One line for the person using the app. */
  message: string;
  /** What to change, when the error identifies it. */
  action?: string;
  /** The untouched provider message, always kept for a bug report. */
  raw: string;
};

const textOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
};

/** Errors axios raises when the request never reached the API. */
const NETWORK_PATTERNS = [
  "network error",
  "timeout",
  "econnrefused",
  "enotfound",
  "failed to fetch",
];

/**
 * Privy refuses a login method it has not been configured to offer. The wording
 * comes from Privy's API, so it is matched loosely rather than exactly.
 */
const PRIVY_NOT_ALLOWED = /\bnot allowed\b|\bnot enabled\b|\bdisabled\b/i;

const PRIVY_RELYING_PARTY = /relying ?party|rp ?id/i;

/**
 * iOS's own wording when it could not verify the associated domain:
 * "Unable to verify webcredentials association of <TEAM>.<bundle> with domain
 * <host>". This can involve the server, Apple's cache or the signed app's
 * entitlements. The message alone cannot distinguish between them.
 */
const DOMAIN_ASSOCIATION =
  /webcredentials|associated ?domain|association of .* with domain/i;

/**
 * Someone closing the sheet is not a misconfiguration. Saying "check your Reown
 * project" here would send them hunting a problem that does not exist.
 */
const CANCELLED =
  /user (rejected|cancell?ed|denied)|cancell?ed by|request rejected|abort|annulée/i;

export const describeAuthFailure = (
  error: unknown,
  context: { method: "passkey" | "oauth" | "wallet" },
): AuthFailure => {
  const raw = textOf(error).trim();
  const lower = raw.toLowerCase();

  if (CANCELLED.test(raw)) {
    return {
      layer: "unknown",
      message: "Sign-in canceled.",
      raw,
    };
  }

  if (NETWORK_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return {
      layer: "network",
      message: "No network response.",
      action:
        "Check this device's connection, then check that the ATARA API responds.",
      raw,
    };
  }

  // Checked before the Privy branches: the operating system, not Privy, is the
  // one refusing here, and the remedies have nothing in common.
  if (DOMAIN_ASSOCIATION.test(raw)) {
    return {
      layer: "api",
      message:
        "iOS could not verify the passkey domain association.",
      action:
        "Update ATARA and try again. If the problem persists, the build's Apple domain association needs checking. Your existing account has not been deleted.",
      raw,
    };
  }

  if (context.method === "passkey") {
    if (/already logged in/i.test(raw)) {
      return {
        layer: "privy",
        message: "An account is still signed in.",
        action: "Log out before creating another account. To protect this account, use Add a passkey in Security.",
        raw,
      };
    }
    if (PRIVY_RELYING_PARTY.test(raw)) {
      return {
        layer: "privy",
        message: "Privy rejected the passkey domain.",
        action:
          "Set api.atara.finance as the relay domain in Privy and verify that /.well-known/apple-app-site-association returns HTTP 200 without a redirect.",
        raw,
      };
    }
    if (PRIVY_NOT_ALLOWED.test(raw)) {
      return {
        layer: "privy",
        message: "Privy does not allow this passkey operation.",
        action:
          "Enable Passkey in the Privy dashboard. Sign-up and sign-in have separate settings.",
        raw,
      };
    }
  }

  if (context.method === "oauth" && PRIVY_NOT_ALLOWED.test(raw)) {
    return {
      layer: "privy",
      message: "Privy does not allow this sign-in provider.",
      action:
        "Enable Google or Apple in Privy and allow the atara://oauth-callback redirect.",
      raw,
    };
  }

  if (context.method === "wallet") {
    return {
      layer: "wallet",
      message: raw || "Wallet sign-in did not finish.",
      action:
        "Check your connection and open your wallet app to confirm the request. You can cancel and try again.",
      raw,
    };
  }

  return {
    layer: "unknown",
    message: raw || "Sign-in incomplete.",
    action:
      "Check in this order: the ATARA API responds; Privy allows this method; and the Reown project allows com.atara.app.",
    raw,
  };
};

/** One string for the gate screen, which has room for two short lines. */
export const formatAuthFailure = (failure: AuthFailure): string =>
  failure.action ? `${failure.message}\n${failure.action}` : failure.message;

const DOMAIN_ASSOCIATION_TIMEOUT_MS = 4000;

/**
 * A passkey refusal has two causes that live outside the app - Privy has not
 * been told to allow the method, or the API is not publishing the association
 * file iOS needs - and the provider string usually names neither. The second
 * one is observable: the association file is a public URL. So the app asks it
 * instead of leaving whoever reads the screen to guess between two settings
 * that look identical from there.
 *
 * Returns undefined when the file is being served correctly, and also when the
 * check could not conclude. A timeout or an offline device says nothing about
 * the server's configuration, and reporting it as one would send someone
 * editing environment variables that were never the problem.
 */
export const probeDomainAssociation = async (
  relyingParty: string,
  timeoutMs: number = DOMAIN_ASSOCIATION_TIMEOUT_MS,
  expectedAppId = "8UTUKDR95M.com.atara.app",
): Promise<AuthFailure | undefined> => {
  const url = `https://${relyingParty}/.well-known/apple-app-site-association`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
      webcredentials?: { apps?: unknown };
    } | null;

    if (response.ok) {
      const apps = body?.webcredentials?.apps;
      if (Array.isArray(apps) && apps.includes(expectedAppId)) return undefined;

      return {
        layer: "api",
        message: `${relyingParty} does not publish this app's association.`,
        action:
          `The file must list ${expectedAppId} in webcredentials.apps.`,
        raw: JSON.stringify(body),
      };
    }

    // The route answers 503 with the name of the variable it is waiting for,
    // which is the one thing worth putting on screen.
    const detail =
      typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;

    return {
      layer: "api",
      message: "The API does not publish the domain association yet.",
      action: `${url} returned ${response.status}: ${detail}`,
      raw: detail,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};
