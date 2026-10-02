/**
 * Passkey ceremonies run by ATARA instead of by the Privy hooks, so that the
 * name iOS lists for a passkey is chosen by the person, and so that the app
 * knows exactly which credential was created or used.
 *
 * Each function follows the steps of `@privy-io/expo` 0.72.0's own hooks
 * (`useSignupWithPasskey`, `useLinkWithPasskey`, `useLoginWithPasskey`), calling
 * the same `@privy-io/js-sdk-core` client methods in the same order. What
 * differs is only what is documented in utils/passkeyOptions.ts: the label, and
 * an optional list of credentials to offer at sign-in.
 *
 * Nothing here decides what to do with a failure. Each error says at which
 * step it happened, because the consequence differs: before a credential
 * exists nothing has changed, and after it exists but before Privy has it, an
 * unused passkey is left in the phone's keychain and the person must be told.
 */

import {
  buildCreationOptions,
  buildRequestOptions,
  challengeFromBytes,
  normalizeCredentialId,
  sameCredential,
  toPrivyCredential,
  type PrivyAuthenticationOptions,
  type PrivyEnrollmentOptions,
} from "../utils/passkeyOptions";
import type { UserLike } from "../utils/loginMethods";

export type PrivyUserLike = NonNullable<UserLike> & { id: string };

/** The part of the Privy client this service uses. */
export interface PasskeyClient {
  auth: {
    passkey: {
      generateSignupOptions(relyingParty?: string): Promise<{ options: PrivyEnrollmentOptions }>;
      generateRegistrationOptions(relyingParty?: string): Promise<{ options: PrivyEnrollmentOptions }>;
      generateAuthenticationOptions(relyingParty?: string): Promise<{ options: PrivyAuthenticationOptions }>;
      signupWithPasskey(input: any, relyingParty?: string, opts?: any): Promise<{ user: any }>;
      linkWithPasskey(input: any, relyingParty?: string): Promise<{ user: any }>;
      loginWithPasskey(input: any, challenge: string, relyingParty?: string, opts?: any): Promise<{ user: any }>;
    };
  };
}

/** The part of `react-native-passkeys` this service uses. */
export interface PasskeyModule {
  create(options: any): Promise<{ id: string; type?: string } | null>;
  get(options: any): Promise<{ id: string; type?: string } | null>;
}

export interface PasskeyDeps {
  client: PasskeyClient;
  passkeys: PasskeyModule;
  randomBytes: (length: number) => ArrayLike<number>;
}

export type PasskeyStage = "options" | "create" | "link" | "sign-in";

const CANCELLED = /cancell?ed|user (rejected|denied)|1001|abort/i;

export class PasskeyFlowError extends Error {
  readonly stage: PasskeyStage;
  readonly cancelled: boolean;
  /**
   * Set when a passkey was created on this phone but Privy never received it.
   * It does nothing and can be deleted in Settings > Passwords; the person is
   * told its name.
   */
  readonly orphanedPasskeyName?: string;
  readonly original: unknown;

  constructor(stage: PasskeyStage, original: unknown, orphanedPasskeyName?: string) {
    const message = original instanceof Error ? original.message : String(original);
    super(message);
    this.name = "PasskeyFlowError";
    this.stage = stage;
    this.original = original;
    this.cancelled = CANCELLED.test(message);
    this.orphanedPasskeyName = orphanedPasskeyName;
  }
}

const at = async <T>(stage: PasskeyStage, run: () => Promise<T>, orphan?: string): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PasskeyFlowError) throw error;
    throw new PasskeyFlowError(stage, error, orphan);
  }
};

export interface CreatedPasskey {
  user: PrivyUserLike;
  /** Normalized: base64url without padding. */
  credentialId: string;
  /** The name given to iOS. */
  label: string;
  /** What Privy's server proposed instead. Kept for diagnostics only. */
  proposedName: string;
}

/**
 * Creates a passkey named `label`.
 *  - "signup": a new Privy user is created from it. There must be no session.
 *  - "link": it is added to the signed-in user, who keeps the same wallet.
 */
export const createNamedPasskey = async (
  { client, passkeys }: PasskeyDeps,
  input: { mode: "signup" | "link"; relyingParty: string; label: string },
): Promise<CreatedPasskey> => {
  const { options } = await at("options", () =>
    input.mode === "signup"
      ? client.auth.passkey.generateSignupOptions(input.relyingParty)
      : client.auth.passkey.generateRegistrationOptions(input.relyingParty),
  );

  const request = buildCreationOptions(options, input.label);
  const label = request.user.name;

  const created = await at("create", async () => {
    const credential = await passkeys.create(request);
    if (!credential) throw new Error("Could not create passkey");
    return credential;
  });

  const result = await at(
    "link",
    () =>
      input.mode === "signup"
        ? client.auth.passkey.signupWithPasskey(toPrivyCredential(created), input.relyingParty)
        : client.auth.passkey.linkWithPasskey(toPrivyCredential(created), input.relyingParty),
    label,
  );

  return {
    user: result.user,
    credentialId: normalizeCredentialId(created.id),
    label,
    proposedName: options.user.name,
  };
};

export interface PasskeySignIn {
  user: PrivyUserLike;
  /** The credential the person authenticated with. */
  credentialId: string;
}

/**
 * Signs in with a passkey. With `credentialId`, only that credential is offered
 * to the person, so the account that signs in is the one they asked for.
 */
export const signInWithPasskey = async (
  { client, passkeys }: PasskeyDeps,
  input: { relyingParty: string; credentialId?: string; embedded?: unknown },
): Promise<PasskeySignIn> => {
  const { options } = await at("options", () =>
    client.auth.passkey.generateAuthenticationOptions(input.relyingParty),
  );

  const assertion = await at("sign-in", async () => {
    const result = await passkeys.get(buildRequestOptions(options, input.credentialId));
    if (!result) throw new Error("Could not find a matching passkey to log in with");
    return result;
  });

  const result = await at("sign-in", () =>
    client.auth.passkey.loginWithPasskey(
      toPrivyCredential(assertion),
      options.challenge,
      input.relyingParty,
      input.embedded ? { embedded: input.embedded } : undefined,
    ),
  );

  return { user: result.user, credentialId: normalizeCredentialId(assertion.id) };
};

export type PasskeyTestResult =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "unavailable"; message: string };

/**
 * Proves a passkey is usable on this phone: iOS is asked to authenticate with
 * that one credential, and the answer is discarded. Privy is not contacted and
 * nothing is signed in or changed.
 */
export const testPasskey = async (
  { passkeys, randomBytes }: Pick<PasskeyDeps, "passkeys" | "randomBytes">,
  input: { rpId: string; credentialId: string },
): Promise<PasskeyTestResult> => {
  try {
    const assertion = await passkeys.get({
      challenge: challengeFromBytes(randomBytes(32)),
      rpId: input.rpId,
      allowCredentials: [{ id: normalizeCredentialId(input.credentialId), type: "public-key" }],
      userVerification: "required",
      timeout: 120_000,
    });
    if (assertion && sameCredential(assertion.id, input.credentialId)) return { ok: true };
    return {
      ok: false,
      reason: "unavailable",
      message: "iOS answered with a different passkey than the one being tested.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // iOS reports "canceled" both when the person closes the sheet and when the
    // phone holds no matching passkey, so neither can be told apart or ruled out.
    if (CANCELLED.test(message)) {
      return {
        ok: false,
        reason: "cancelled",
        message:
          "The test did not complete. Either you canceled it, or this iPhone does not hold this passkey (it may be on another device, or deleted in Settings > Passwords).",
      };
    }
    return {
      ok: false,
      reason: "unavailable",
      message:
        "This passkey could not be used on this iPhone. It may be stored on another device, or have been deleted in Settings > Passwords.",
    };
  }
};
