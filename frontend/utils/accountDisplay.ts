/**
 * The words the account screens use for an account. Text for a person to read:
 * nothing here decides which account anything belongs to.
 */

import type { LocalAccount, SwitchPlan } from "./accountRegistry";

/** Second line of an account: the public @handle, or why there is none. */
export const accountHeadline = (account: LocalAccount): string => {
  if (account.profileDeletedAt) return "ATARA profile deleted";
  if (account.handle) return `@${account.handle}`;
  return "Setup not finished";
};

/**
 * What the phone knows about how this account signs in, worded so that a person
 * can find its passkey in iOS. A passkey made by ATARA carries the name given to
 * iOS. One made before that carries whatever Privy proposed, which the app
 * cannot read: everything points at "ATARA", so that is said as a probability.
 */
export const accountAccessLines = (account: LocalAccount): string[] => {
  const lines: string[] = [];
  const named = account.passkeys.filter((passkey) => passkey.name);
  const legacy = account.passkeys.filter((passkey) => !passkey.name);

  if (named.length > 0) {
    lines.push(
      `${named.length === 1 ? "iOS passkey" : "iOS passkeys"}: ${named
        .map((passkey) => `“${passkey.name}”`)
        .join(", ")}`,
    );
  }
  if (legacy.length > 0) {
    lines.push(
      legacy.length === 1
        ? "1 passkey created before names existed. iOS probably lists it as “ATARA”."
        : `${legacy.length} passkeys created before names existed. iOS probably lists them as “ATARA”.`,
    );
  }
  if (account.authProvider === "google") lines.push("Created with Google");
  if (account.authProvider === "apple") lines.push("Created with Apple");
  return lines;
};

/** How the next sign-in will happen, for the confirmation before a switch. */
export const describeSwitchMethod = (plan: SwitchPlan): string => {
  if (plan.method === "passkey") return "its passkey. iOS will ask for Face ID, Touch ID or your passcode";
  if (plan.method === "oauth") return plan.provider === "google" ? "Google" : "Apple";
  return "the method you choose on the next screen";
};
