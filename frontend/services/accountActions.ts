/**
 * What the account screens do, kept apart from the screens so each step can be
 * checked without a phone. Everything the steps touch is passed in.
 *
 * Three removals exist and they are not the same thing:
 *  - removeAccountFromDevice: forgets the account on THIS phone and signs it
 *    out. The ATARA account, the wallet, the funds and the passkey all remain.
 *  - removePasskeyFromAccount: unlinks one passkey from the sign-in methods of
 *    the account at Privy, only when another way in is known to work.
 *  - deleting the ATARA account: see hooks/useAccountDeletion.ts.
 */

import {
  displayLabel,
  findAccount,
  planSwitch,
  type Identity,
  type LocalAccount,
  type RegistryState,
} from "../utils/accountRegistry";
import {
  assessPasskeyRemoval,
  listPasskeys,
  rawCredentialId,
  type RemovalAssessment,
  type UserLike,
} from "../utils/loginMethods";
import { normalizeCredentialId } from "../utils/passkeyOptions";
import type { AccountIntent, SwitchTarget } from "../stores/useAccountSwitchStore";

export const removeAccountFromDevice = async (deps: {
  account: LocalAccount;
  /** The account signed in right now. */
  isActive: boolean;
  logout: () => Promise<void>;
  forgetRegistryEntry: (key: string) => Promise<void>;
  forgetNicknames: (userId: string) => void;
}): Promise<void> => {
  // Sign out first. If it fails, nothing has been forgotten and the person is
  // told: a session must not stay open for an account this phone claims to have
  // dropped.
  if (deps.isActive) await deps.logout();
  await deps.forgetRegistryEntry(deps.account.key);
  // Nicknames are private notes kept on this phone for this account.
  if (deps.account.userId) deps.forgetNicknames(deps.account.userId);
  // Deliberately kept: the unfinished-payment records. They belong to the money,
  // not to the entry in this list, and protect it if the account comes back.
};

export const buildSwitchTarget = (account: LocalAccount, all: readonly LocalAccount[]): SwitchTarget => ({
  accountKey: account.key,
  label: displayLabel(account, all),
  handle: account.handle,
  privyUserId: account.privyUserId,
  plan: planSwitch(account),
});

/**
 * Switching is a sign-out followed by a sign-in that the person confirms with
 * the account's own passkey or provider. The current account is signed out
 * first, which is what empties balances, contacts and cached data
 * (see stores/useAuthStore.ts): nothing of it survives into the next session.
 */
export const switchToAccount = async (deps: {
  target: SwitchTarget;
  begin: (intent: AccountIntent) => void;
  clear: () => void;
  logout: () => Promise<void>;
}): Promise<void> => {
  deps.begin({ kind: "switch", target: deps.target });
  try {
    await deps.logout();
  } catch (error) {
    deps.clear();
    throw error;
  }
};

export const startAddingAccount = async (deps: {
  begin: (intent: AccountIntent) => void;
  clear: () => void;
  logout: () => Promise<void>;
}): Promise<void> => {
  deps.begin({ kind: "add" });
  try {
    await deps.logout();
  } catch (error) {
    deps.clear();
    throw error;
  }
};

export type PasskeyRemovalOutcome =
  | { ok: true }
  | { ok: false; reason: "refused"; assessment: Extract<RemovalAssessment, { allowed: false }> }
  | { ok: false; reason: "not-confirmed" }
  | { ok: false; reason: "failed"; message: string };

/**
 * Unlinks a passkey from the account's sign-in methods, then checks with Privy
 * that it is gone. Refuses first, without contacting Privy, unless another way
 * in exists that is known to work (see utils/loginMethods.ts).
 *
 * This does not delete the passkey from the phone. iOS keeps its own copy until
 * the person deletes it in Settings > Passwords, and no app can do that for them.
 */
export const removePasskeyFromAccount = async (deps: {
  user: UserLike;
  credentialId: string;
  verifiedCredentialIds: readonly string[];
  unlink: (input: { credentialId: string; removeAsMfa?: boolean }) => Promise<void>;
  refreshUser: () => Promise<{ user: UserLike }>;
}): Promise<PasskeyRemovalOutcome> => {
  const assessment = assessPasskeyRemoval({
    user: deps.user,
    credentialId: deps.credentialId,
    verifiedCredentialIds: deps.verifiedCredentialIds,
  });
  if (!assessment.allowed) return { ok: false, reason: "refused", assessment };

  const wanted = normalizeCredentialId(deps.credentialId);
  const raw = rawCredentialId(deps.user, wanted);
  const summary = listPasskeys(deps.user).find((passkey) => passkey.credentialId === wanted);
  if (!raw || !summary) return { ok: false, reason: "refused", assessment: { allowed: false, reason: "not-linked", alternatives: [] } };

  try {
    await deps.unlink({ credentialId: raw, ...(summary.enrolledInMfa ? { removeAsMfa: true } : {}) });
  } catch (error) {
    return { ok: false, reason: "failed", message: error instanceof Error ? error.message : String(error) };
  }

  try {
    const { user } = await deps.refreshUser();
    return listPasskeys(user).some((passkey) => passkey.credentialId === wanted)
      ? { ok: false, reason: "not-confirmed" }
      : { ok: true };
  } catch {
    return { ok: false, reason: "not-confirmed" };
  }
};

export type Landing =
  | { matched: true; account?: LocalAccount }
  | { matched: false; landed: LocalAccount; expected?: LocalAccount };

/**
 * After a switch: did the sign-in reach the account the person chose? Decided by
 * the Privy user id, never by a name.
 */
export const checkLanding = (
  state: RegistryState,
  intent: AccountIntent | null,
  landed: Identity,
): Landing => {
  const account = findAccount(state, landed);
  if (!intent || intent.kind !== "switch" || !account) return { matched: true, account };
  if (account.key === intent.target.accountKey) return { matched: true, account };
  return {
    matched: false,
    landed: account,
    expected: state.accounts.find((candidate) => candidate.key === intent.target.accountKey),
  };
};
