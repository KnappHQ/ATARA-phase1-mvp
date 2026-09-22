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

  // Checked before the Privy branches: the operating system, not Privy, is the
  // one refusing here, and the remedies have nothing in common.
  if (DOMAIN_ASSOCIATION.test(raw)) {
    return {
      layer: "api",
      message:
        "Le système n'a pas pu vérifier l'association de domaine des passkeys.",
      action:
        "Mets ATARA à jour puis réessaie. Si le problème persiste, l'association Apple du build doit être vérifiée. Ton compte existant n'est pas supprimé.",
      raw,
    };
  }

  if (context.method === "passkey") {
    if (/already logged in/i.test(raw)) {
      return {
        layer: "privy",
        message: "Une session est encore ouverte.",
        action: "Déconnecte-toi avant de créer un autre compte. Pour protéger le compte actuel, utilise Ajouter une passkey dans Sécurité.",
        raw,
      };
    }
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

  if (context.method === "wallet") {
    return {
      layer: "wallet",
      message: raw || "La connexion au wallet n'a pas abouti.",
      action:
        "Vérifie ta connexion et ouvre ton application wallet pour confirmer la demande. Tu peux annuler et réessayer.",
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
        message: `${relyingParty} ne publie pas l'association de cette application.`,
        action:
          `Le fichier doit contenir webcredentials.apps avec ${expectedAppId}.`,
        raw: JSON.stringify(body),
      };
    }

    // The route answers 503 with the name of the variable it is waiting for,
    // which is the one thing worth putting on screen.
    const detail =
      typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;

    return {
      layer: "api",
      message: "L'API ne publie pas encore l'association de domaine.",
      action: `${url} répond ${response.status} : ${detail}`,
      raw: detail,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};
