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

const PRIVY_RELYING_PARTY = /relying ?party|rp ?id|associated ?domain/i;

/**
 * Someone closing the sheet is not a misconfiguration. Saying "check your Reown
 * project" here would send them hunting a problem that does not exist.
 */
const CANCELLED =
  /user (rejected|cancell?ed|denied)|cancell?ed by|request rejected|abort/i;

/**
 * Alchemy sends the API key as `Authorization: Bearer <key>`, so the request URL
 * legitimately ends at `/v2` with no key in the path - that part is not the
 * fault. "Must be authenticated!" means Alchemy received the header and refused
 * the credential behind it.
 */
const ALCHEMY_REFUSED =
  /must be authenticated|alchemy\.com|wallet_requestAccount|unauthorized/i;

export const describeAuthFailure = (
  error: unknown,
  context: { method: "passkey" | "oauth" | "wallet" | "registration" },
): AuthFailure => {
  const raw = textOf(error).trim();
  const lower = raw.toLowerCase();

  if (CANCELLED.test(raw)) {
    return {
      layer: "unknown",
      message: "Connexion annulée.",
      raw,
    };
  }

  if (NETWORK_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return {
      layer: "network",
      message: "Aucune réponse du réseau.",
      action:
        "Vérifiez la connexion de l'appareil, puis que l'API ATARA répond.",
      raw,
    };
  }

  if (context.method === "passkey") {
    if (PRIVY_RELYING_PARTY.test(raw)) {
      return {
        layer: "privy",
        message: "Privy refuse le domaine de passkey.",
        action:
          "Déclarez api.atara.finance comme domaine relais dans l'application Privy, et vérifiez que /.well-known/apple-app-site-association répond 200 sans redirection.",
        raw,
      };
    }
    if (PRIVY_NOT_ALLOWED.test(raw)) {
      return {
        layer: "privy",
        message: "Privy n'autorise pas cette opération par passkey.",
        action:
          "Activez la méthode Passkey pour cette application dans le dashboard Privy — création et connexion sont deux réglages distincts.",
        raw,
      };
    }
  }

  if (context.method === "oauth" && PRIVY_NOT_ALLOWED.test(raw)) {
    return {
      layer: "privy",
      message: "Privy n'autorise pas ce fournisseur.",
      action:
        "Activez Google ou Apple dans le dashboard Privy, et autorisez la redirection atara://oauth-callback.",
      raw,
    };
  }

  if (context.method === "registration" && ALCHEMY_REFUSED.test(raw)) {
    return {
      layer: "api",
      message: "Alchemy refuse la clé utilisée pour créer le smart account.",
      action:
        "Vérifiez que EXPO_PUBLIC_ALCHEMY_API_KEY est bien la clé d'une app Alchemy dont les Wallet APIs (Smart Wallets) sont activées, et que la gas policy appartient à cette même app.",
      raw,
    };
  }

  if (context.method === "wallet") {
    return {
      layer: "wallet",
      message: "La connexion au wallet n'a pas abouti.",
      action:
        "Vérifiez que com.atara.app est autorisé dans le projet Reown, sur iOS comme sur Android.",
      raw,
    };
  }

  return {
    layer: "unknown",
    message: raw || "Connexion non terminée.",
    action:
      "À vérifier dans cet ordre : l'API ATARA répond, l'application Privy autorise cette méthode, le projet Reown autorise com.atara.app.",
    raw,
  };
};

/** One string for the gate screen, which has room for two short lines. */
export const formatAuthFailure = (failure: AuthFailure): string =>
  failure.action ? `${failure.message}\n${failure.action}` : failure.message;
