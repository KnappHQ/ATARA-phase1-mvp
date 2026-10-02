import { normalizeCredentialId } from "./passkeyOptions";

/**
 * The ways a Privy user can sign in, and whether one of them may be removed.
 *
 * Privy itself only requires "at least one other linked account" before it
 * unlinks a passkey, and an embedded wallet is a linked account. Counting it
 * would let someone remove their last way in. What matters here is a method
 * this app can actually sign in with: its sign-in screen offers a passkey,
 * Google and Apple, nothing else.
 */

/**
 * The fields of a Privy linked account this file reads. Declared here, rather
 * than as an index signature, so the SDK's own `User` type is accepted as is.
 */
interface LinkedAccountLike {
  type: string;
  credential_id?: unknown;
  authenticator_name?: unknown;
  created_with_device?: unknown;
  created_with_os?: unknown;
  created_with_browser?: unknown;
  first_verified_at?: unknown;
  latest_verified_at?: unknown;
  enrolled_in_mfa?: unknown;
}
export type UserLike = { linked_accounts?: readonly LinkedAccountLike[] } | null | undefined;

export interface PasskeySummary {
  /** Normalized: base64url without padding. */
  credentialId: string;
  authenticatorName?: string;
  device?: string;
  os?: string;
  browser?: string;
  firstVerifiedAt?: number | null;
  latestVerifiedAt?: number | null;
  enrolledInMfa: boolean;
}

export interface LoginMethod {
  kind: "passkey" | "google" | "apple";
  /** The normalized credential id for a passkey, the type otherwise. */
  id: string;
  label: string;
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;
const time = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const listPasskeys = (user: UserLike): PasskeySummary[] =>
  (user?.linked_accounts ?? [])
    .filter((account) => account.type === "passkey" && typeof account.credential_id === "string")
    .map((account) => ({
      credentialId: normalizeCredentialId(String(account.credential_id)),
      authenticatorName: text(account.authenticator_name),
      device: text(account.created_with_device),
      os: text(account.created_with_os),
      browser: text(account.created_with_browser),
      firstVerifiedAt: time(account.first_verified_at),
      latestVerifiedAt: time(account.latest_verified_at),
      enrolledInMfa: account.enrolled_in_mfa === true,
    }));

/**
 * The credential id exactly as Privy lists it. Privy's own calls take that
 * spelling, so it is what an unlink request must carry, not the normalized one.
 */
export const rawCredentialId = (user: UserLike, credentialId: string): string | undefined => {
  const wanted = normalizeCredentialId(credentialId);
  const match = (user?.linked_accounts ?? []).find(
    (account) =>
      account.type === "passkey" &&
      typeof account.credential_id === "string" &&
      normalizeCredentialId(account.credential_id) === wanted,
  );
  return match ? String(match.credential_id) : undefined;
};

export const listLoginMethods = (user: UserLike): LoginMethod[] => {
  const methods: LoginMethod[] = listPasskeys(user).map((passkey) => ({
    kind: "passkey" as const,
    id: passkey.credentialId,
    label: "Passkey",
  }));
  for (const account of user?.linked_accounts ?? []) {
    if (account.type === "google_oauth") methods.push({ kind: "google", id: "google", label: "Google account" });
    if (account.type === "apple_oauth") methods.push({ kind: "apple", id: "apple", label: "Apple account" });
  }
  return methods;
};

export type RemovalAssessment =
  | { allowed: true; usable: LoginMethod[] }
  | {
      allowed: false;
      reason: "not-linked" | "last-method" | "untested-alternative";
      /** The methods that would remain, tested or not. */
      alternatives: LoginMethod[];
    };

/**
 * May this passkey be removed from the account?
 *
 * Only if another method remains AND one of the remaining methods is known to
 * work: a Google or Apple account, or a passkey that was proven on this phone.
 * A passkey Privy lists is not proof: it can live on another Apple ID, or have
 * been deleted from Passwords, and then removing the only one that works would
 * lock the person out of funds nobody else can move.
 *
 * `verifiedCredentialIds` are the credentials this phone has used or created
 * successfully, from ATARA's own flows.
 */
export const assessPasskeyRemoval = ({
  user,
  credentialId,
  verifiedCredentialIds,
}: {
  user: UserLike;
  credentialId: string;
  verifiedCredentialIds: readonly string[];
}): RemovalAssessment => {
  const target = normalizeCredentialId(credentialId);
  const all = listLoginMethods(user);
  if (!all.some((method) => method.kind === "passkey" && method.id === target)) {
    return { allowed: false, reason: "not-linked", alternatives: all };
  }

  const others = all.filter((method) => !(method.kind === "passkey" && method.id === target));
  if (others.length === 0) return { allowed: false, reason: "last-method", alternatives: [] };

  const verified = new Set(verifiedCredentialIds.map(normalizeCredentialId));
  const usable = others.filter((method) => method.kind !== "passkey" || verified.has(method.id));
  if (usable.length === 0) return { allowed: false, reason: "untested-alternative", alternatives: others };

  return { allowed: true, usable };
};

export const REMOVAL_REFUSAL_TEXT: Record<
  Extract<RemovalAssessment, { allowed: false }>["reason"],
  string
> = {
  "not-linked": "This passkey is no longer linked to your account.",
  "last-method":
    "This is the only way to sign in to this account. Add a second passkey, or link a Google or Apple account, before removing it.",
  "untested-alternative":
    "Your other passkey has not been checked on this iPhone. Test it first: if it is not on this phone, removing this one could lock you out of your funds.",
};
