import { useCallback, useMemo } from "react";

import { useAuth } from "@/providers/AuthProvider";
import { UserService } from "@/services/user.service";
import { useAccountRegistryStore } from "@/stores/useAccountRegistryStore";
import { useAddressBookStore } from "@/stores/useAddressBookStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { describeFunds } from "@/utils/accountDeletion";

/**
 * Deleting the ATARA account (the third kind of removal, next to "remove from
 * this iPhone" and "remove a passkey"). It calls the authenticated deletion
 * route, then cleans this phone and signs out.
 *
 * It does not touch the passkeys or the wallet: Privy keeps them, and so does
 * iOS. That is why the wallet's address stays in this phone's list of accounts.
 */
export const useAccountDeletion = () => {
  const { logout } = useAuth();
  const assets = useWalletStore((state) => state.assets);
  const balanceError = useWalletStore((state) => state.balanceError);
  const isLoading = useWalletStore((state) => state.isLoadingBalances);
  const source = useWalletStore((state) => state.balanceSource);

  const funds = useMemo(
    () => describeFunds(assets, balanceError, isLoading, source),
    [assets, balanceError, isLoading, source],
  );

  const deleteAccount = useCallback(async () => {
    const { user, token } = useAuthStore.getState();
    if (!user || !token) throw new Error("Sign in again to delete your account.");

    try {
      await UserService.deleteAccount();
    } catch (error: any) {
      // Nothing was deleted: the request failed before, or instead of, the change.
      throw new Error(
        error?.response?.data?.message || "Unable to delete your account. Nothing was deleted.",
      );
    }

    // From here the profile is gone, so signing out is not optional. A problem
    // cleaning this phone must not stop it.
    try {
      const registry = useAccountRegistryStore.getState();
      const entry = registry.find({ userId: user.id });
      if (entry) await registry.profileDeleted(entry.key, Date.now());
      // Nicknames live on this phone only; the server cannot delete them.
      useAddressBookStore.getState().forget(user.id);
    } catch {
      // The list of accounts is a convenience.
    }
    await logout();
  }, [logout]);

  return { funds, deleteAccount };
};
