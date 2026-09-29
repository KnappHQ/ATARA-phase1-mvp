import { useCallback, useMemo } from "react";
import { usePrivy, usePrivyClient, useUnlinkPasskey } from "@privy-io/expo";

import { removePasskeyFromAccount, type PasskeyRemovalOutcome } from "@/services/accountActions";
import { PasskeyFlowError, createNamedPasskey, testPasskey } from "@/services/passkey.service";
import { createPasskeyDeps, passkeyRelyingParty, passkeyRelyingPartyUrl, randomBytes } from "@/services/passkeyRuntime";
import { useAccountRegistryStore } from "@/stores/useAccountRegistryStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { REGISTRY_VERSION, findAccount, verifiedCredentialIds } from "@/utils/accountRegistry";
import { describeAuthFailure, formatAuthFailure } from "@/utils/authDiagnostics";
import { listLoginMethods, listPasskeys } from "@/utils/loginMethods";

export type AddPasskeyResult =
  | { ok: true; label: string }
  | { ok: false; cancelled: boolean; message: string };

/**
 * A second passkey for the signed-in account, named by the person. iOS and
 * Privy decide whether it can exist, so a refusal is explained rather than
 * shown as the SDK's raw text.
 */
const explainAddFailure = (error: unknown): AddPasskeyResult => {
  if (error instanceof PasskeyFlowError) {
    if (error.cancelled) return { ok: false, cancelled: true, message: "Canceled. Nothing was added." };
    if (error.orphanedPasskeyName) {
      return {
        ok: false,
        cancelled: false,
        message: `A passkey named “${error.orphanedPasskeyName}” was created on this iPhone but could not be linked to your account. It does nothing: delete it in Settings > Passwords, then try again.`,
      };
    }
    if (error.stage === "create") {
      return {
        ok: false,
        cancelled: false,
        message:
          "iOS did not create the passkey. When this iPhone already holds a passkey for this account, iOS refuses a second one so it cannot be replaced by accident. Another way in, such as a Google or Apple account, can be added instead. Nothing was changed.",
      };
    }
  }
  const failure = describeAuthFailure(error instanceof PasskeyFlowError ? error.original : error, { method: "passkey" });
  return { ok: false, cancelled: false, message: formatAuthFailure(failure) };
};

/**
 * Everything the "Passkeys and sign-in methods" screen needs for the account that
 * is signed in. Each action changes Privy or the phone's passkeys, and reports
 * what it verified rather than what it hoped.
 */
export const usePasskeyManagement = () => {
  const { user: privyUser, isReady, refreshUser } = usePrivy();
  const client = usePrivyClient();
  const { unlink } = useUnlinkPasskey();
  const profile = useAuthStore((state) => state.user);
  const accounts = useAccountRegistryStore((state) => state.accounts);
  const deps = useMemo(() => createPasskeyDeps(client), [client]);

  const account = useMemo(
    () =>
      findAccount(
        { version: REGISTRY_VERSION, accounts },
        { privyUserId: privyUser?.id, userId: profile?.id },
      ),
    [accounts, privyUser?.id, profile?.id],
  );
  const passkeys = useMemo(() => listPasskeys(privyUser), [privyUser]);
  const methods = useMemo(() => listLoginMethods(privyUser), [privyUser]);

  const relyingParty = passkeyRelyingPartyUrl();
  const rpId = passkeyRelyingParty();
  const isAvailable = isReady && !!privyUser && !!account && profile?.authProvider !== "external_wallet";

  const add = useCallback(
    async (label: string): Promise<AddPasskeyResult> => {
      if (!relyingParty) {
        return { ok: false, cancelled: false, message: "Passkeys need the secure domain to be configured." };
      }
      if (!account) {
        return { ok: false, cancelled: false, message: "This account is not ready yet. Try again in a moment." };
      }
      try {
        const created = await createNamedPasskey(deps, { mode: "link", relyingParty, label });
        // Created and linked in one step: it is known to work on this phone.
        await useAccountRegistryStore
          .getState()
          .addPasskey(account.key, { credentialId: created.credentialId, name: created.label, now: Date.now() });
        await refreshUser().catch(() => undefined);
        return { ok: true, label: created.label };
      } catch (error) {
        return explainAddFailure(error);
      }
    },
    [account, deps, refreshUser, relyingParty],
  );

  const test = useCallback(
    async (credentialId: string) => {
      if (!rpId) return { ok: false as const, reason: "unavailable" as const, message: "Passkeys need the secure domain to be configured." };
      if (!account) return { ok: false as const, reason: "unavailable" as const, message: "This account is not ready yet. Try again in a moment." };
      const result = await testPasskey({ passkeys: deps.passkeys, randomBytes }, { rpId, credentialId });
      if (result.ok) await useAccountRegistryStore.getState().markVerified(account.key, credentialId, Date.now());
      return result;
    },
    [account, deps.passkeys, rpId],
  );

  const remove = useCallback(
    async (credentialId: string): Promise<PasskeyRemovalOutcome> => {
      if (!account) return { ok: false, reason: "failed", message: "This account is not ready yet. Try again in a moment." };
      const outcome = await removePasskeyFromAccount({
        user: privyUser,
        credentialId,
        verifiedCredentialIds: verifiedCredentialIds(account),
        unlink,
        refreshUser,
      });
      if (outcome.ok) await useAccountRegistryStore.getState().removePasskey(account.key, credentialId);
      return outcome;
    },
    [account, privyUser, refreshUser, unlink],
  );

  return { isAvailable, account, passkeys, methods, privyUser, add, test, remove, hasDomain: !!relyingParty };
};
