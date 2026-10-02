/**
 * The parameters ATARA hands to the operating system's passkey API.
 *
 * Why this exists. `@privy-io/expo` 0.72.0 builds the iOS/Android call itself:
 * it asks Privy for WebAuthn options and forwards `user.name` from Privy's
 * answer, then spreads its `extra_options` argument *before* `rp`, `user`,
 * `challenge` and the rest, so nothing passed by the app can change them. iOS
 * lists a passkey by that `user.name` (react-native-passkeys 0.4.1 hands it to
 * `createCredentialRegistrationRequest(challenge:name:userID:)`, and ignores
 * `displayName` on the platform path). Every passkey therefore carried the one
 * name Privy's server proposes, whichever account it belonged to.
 *
 * The name is not part of anything the authenticator signs, and it is not sent
 * back to Privy (`signupWithPasskey` posts the attestation, the client data and
 * the credential id only). So the options can be built here from Privy's own
 * answer with one difference: the label. Everything else is copied exactly as
 * the SDK copies it, including the user handle (`user.id`) and the list of
 * credentials to exclude, which are what stop iOS from silently replacing an
 * existing passkey.
 */

import { normalizeAccountLabel } from "./accountLabels";

/** Privy's snake_case answer, as typed by @privy-io/api-types. */
export interface PrivyEnrollmentOptions {
  challenge: string;
  pub_key_cred_params: { type: string; alg: number }[];
  rp: { id?: string; name: string };
  user: { id: string; name: string; display_name: string };
  authenticator_selection?: {
    authenticator_attachment?: string;
    resident_key?: string;
    user_verification?: string;
    require_resident_key?: boolean;
  };
  exclude_credentials?: { id: string; type: string; transports?: string[] }[];
  timeout?: number;
}

export interface PrivyAuthenticationOptions {
  challenge: string;
  rp_id: string;
  allow_credentials?: { id: string; type: string; transports?: string[] }[];
  user_verification?: string;
  timeout?: number;
}

/** The same 2-minute limit the SDK applies. */
export const PASSKEY_TIMEOUT_MS = 120_000;

/** Credential ids are compared without padding and in base64url. */
export const normalizeCredentialId = (id: string): string =>
  id.trim().replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

export const sameCredential = (a?: string | null, b?: string | null): boolean =>
  !!a && !!b && normalizeCredentialId(a) === normalizeCredentialId(b);

/**
 * Registration options for `react-native-passkeys`' `create`, from Privy's
 * answer, with `label` as the name iOS and Android will show.
 */
export const buildCreationOptions = (
  options: PrivyEnrollmentOptions,
  label: string,
) => {
  const name = normalizeAccountLabel(label);
  if (!name) throw new Error("A passkey needs a name.");
  const selection = options.authenticator_selection;

  return {
    rp: options.rp,
    // Only name and displayName change. `id` is the user handle Privy chose.
    user: { id: options.user.id, name, displayName: name },
    challenge: options.challenge,
    pubKeyCredParams: options.pub_key_cred_params,
    excludeCredentials: options.exclude_credentials,
    authenticatorSelection: {
      authenticatorAttachment: selection?.authenticator_attachment,
      residentKey: selection?.resident_key,
      userVerification: selection?.user_verification,
      requireResidentKey: selection?.require_resident_key,
    },
    timeout: PASSKEY_TIMEOUT_MS,
    attestation: undefined,
  };
};

/**
 * Sign-in options for `get`. With `credentialId`, only that credential is
 * offered: the person is not asked to pick among identical entries, and the
 * account that signs in is the one they chose.
 */
export const buildRequestOptions = (
  options: PrivyAuthenticationOptions,
  credentialId?: string,
) => ({
  challenge: options.challenge,
  rpId: options.rp_id,
  allowCredentials: credentialId
    ? [{ id: normalizeCredentialId(credentialId), type: "public-key" as const }]
    : options.allow_credentials,
  userVerification: options.user_verification,
  timeout: PASSKEY_TIMEOUT_MS,
});

/** What the SDK adds before giving a created credential back to Privy. */
export const toPrivyCredential = <T extends { type?: string }>(credential: T) => ({
  ...credential,
  type: credential.type ?? "public-key",
  clientExtensionResults: {},
});

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** A random challenge for a check that never leaves the phone. */
export const challengeFromBytes = (bytes: ArrayLike<number>): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    out += BASE64URL[a >> 2] + BASE64URL[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) out += BASE64URL[((b & 15) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) out += BASE64URL[c & 63];
  }
  return out;
};
