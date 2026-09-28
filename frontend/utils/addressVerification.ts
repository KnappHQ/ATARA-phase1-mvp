/**
 * The receiving address the app shows comes from ATARA's service, which stored
 * it at sign-up. If that service were compromised it could hand back someone
 * else's address, and every payment the user asked for would go there.
 *
 * The phone can check this without trusting the service: the smart account is
 * derived from the signer on this device. "verified" means the derivation
 * matches. "mismatch" means it does not. "unverified" means the check could not
 * run (offline, provider down) — which says nothing about the address, so it is
 * never treated as a failure and never blocks anything.
 */
export type AddressVerification = "verified" | "mismatch" | "unverified";

export const compareDerivedAddress = (
  stored: string | null | undefined,
  derived: string | null | undefined,
): AddressVerification => {
  if (!stored || !derived) return "unverified";
  return stored.toLowerCase() === derived.toLowerCase() ? "verified" : "mismatch";
};
