import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  REGISTRY_VERSION,
  addPasskeyRecord,
  beginPendingAccount,
  emptyRegistry,
  findAccount,
  markPasskeyVerified,
  markProfileDeleted,
  recordSignIn,
  removeAccount,
  removePasskeyRecord,
  renameAccount,
  sanitizeRegistry,
  type Identity,
  type LocalAccount,
  type RenameResult,
  type SignInSnapshot,
} from "../utils/accountRegistry";

/**
 * The accounts known on this phone. See utils/accountRegistry.ts.
 *
 * This store is deliberately NOT registered with `onAccountReset`: signing out,
 * or switching to another account, must not forget the accounts that can be
 * switched to. Only `remove` forgets one.
 */
interface AccountRegistryState {
  accounts: LocalAccount[];
  version: number;

  /**
   * Every write waits for the stored list to be loaded first. A write made
   * before that would be saved over the list still on disk, and the accounts
   * in it would be gone.
   */

  /** A passkey was just created for a new Privy user; there is no @handle yet. */
  beginPending: (input: { key: string; privyUserId: string; label: string; credentialId: string; now: number }) => Promise<void>;
  recordSignIn: (snapshot: SignInSnapshot) => Promise<void>;
  rename: (key: string, label: string) => Promise<RenameResult>;
  remove: (key: string) => Promise<void>;
  profileDeleted: (key: string, now: number) => Promise<void>;
  markVerified: (key: string, credentialId: string, now: number) => Promise<void>;
  addPasskey: (key: string, input: { credentialId: string; name: string; now: number }) => Promise<void>;
  removePasskey: (key: string, credentialId: string) => Promise<void>;
  find: (identity: Identity) => LocalAccount | undefined;
}

export const useAccountRegistryStore = create<AccountRegistryState>()(
  persist(
    (set, get) => {
      const apply = (next: { accounts: LocalAccount[]; version: number }): void => {
        set({ accounts: next.accounts, version: next.version });
      };
      const snapshot = () => ({ accounts: get().accounts, version: REGISTRY_VERSION });
      const write = async <T,>(run: () => T): Promise<T> => {
        await registryReady();
        return run();
      };

      return {
        ...emptyRegistry(),

        beginPending: (input) => write(() => apply(beginPendingAccount(snapshot(), input))),
        recordSignIn: (input) => write(() => apply(recordSignIn(snapshot(), input))),
        rename: (key, label) =>
          write(() => {
            const { state, result } = renameAccount(snapshot(), key, label);
            if (result.ok) apply(state);
            return result;
          }),
        remove: (key) => write(() => apply(removeAccount(snapshot(), key))),
        profileDeleted: (key, now) => write(() => apply(markProfileDeleted(snapshot(), key, now))),
        markVerified: (key, credentialId, now) =>
          write(() => apply(markPasskeyVerified(snapshot(), key, credentialId, now))),
        addPasskey: (key, input) => write(() => apply(addPasskeyRecord(snapshot(), key, input))),
        removePasskey: (key, credentialId) =>
          write(() => apply(removePasskeyRecord(snapshot(), key, credentialId))),
        find: (identity) => findAccount(snapshot(), identity),
      };
    },
    {
      name: "atara-account-registry",
      version: REGISTRY_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ accounts: state.accounts, version: state.version }),
      // Whatever storage holds, only well-formed entries are loaded.
      migrate: (persisted) => sanitizeRegistry(persisted),
      // Nothing stored (first launch): keep what is already in memory.
      merge: (persisted, current) =>
        persisted ? { ...current, ...sanitizeRegistry(persisted) } : current,
    },
  ),
);

/** Storage that never answers must not freeze every write forever. */
const HYDRATION_TIMEOUT_MS = 5000;

/** Resolves once the stored list has been loaded into memory. */
export const registryReady = (): Promise<void> =>
  new Promise((resolve) => {
    if (useAccountRegistryStore.persist.hasHydrated()) return resolve();
    const timer = setTimeout(done, HYDRATION_TIMEOUT_MS);
    const unsubscribe = useAccountRegistryStore.persist.onFinishHydration(done);
    function done() {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    }
  });
