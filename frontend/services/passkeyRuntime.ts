import { getRandomBytes } from "expo-crypto";

import type { PasskeyClient, PasskeyDeps, PasskeyModule } from "./passkey.service";

/**
 * The real passkey module, loaded on first use exactly as `@privy-io/expo` does
 * (`react-native-passkeys` is native code, and a device without it must still
 * open the app).
 */
const nativePasskeys: PasskeyModule = {
  create: async (options) => (await import("react-native-passkeys")).create(options),
  get: async (options) => (await import("react-native-passkeys")).get(options),
};

export const createPasskeyDeps = (client: unknown): PasskeyDeps => ({
  client: client as PasskeyClient,
  passkeys: nativePasskeys,
  randomBytes: (length) => getRandomBytes(length),
});

export const randomBytes = (length: number): Uint8Array => getRandomBytes(length);

/** The domain passkeys are bound to, or undefined while it is not configured. */
export const passkeyRelyingParty = (): string | undefined =>
  process.env.EXPO_PUBLIC_PASSKEY_RP_ID?.trim() || undefined;

/** Privy's calls take the relying party as a URL. */
export const passkeyRelyingPartyUrl = (): string | undefined => {
  const domain = passkeyRelyingParty();
  return domain ? `https://${domain}` : undefined;
};
