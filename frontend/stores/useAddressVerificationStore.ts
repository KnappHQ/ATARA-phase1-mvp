import { create } from "zustand";

import { onAccountReset } from "@/utils/accountScope";
import type { AddressVerification } from "@/utils/addressVerification";

type AddressVerificationState = {
  /** Lower-cased address the result applies to. */
  address?: string;
  status: AddressVerification;
  setResult: (address: string, status: AddressVerification) => void;
  /** The result for `address`, or "unverified" if it was checked for another. */
  statusFor: (address?: string | null) => AddressVerification;
  reset: () => void;
};

export const useAddressVerificationStore = create<AddressVerificationState>((set, get) => ({
  address: undefined,
  status: "unverified",
  setResult: (address, status) => set({ address: address.toLowerCase(), status }),
  statusFor: (address) =>
    address && get().address === address.toLowerCase() ? get().status : "unverified",
  reset: () => set({ address: undefined, status: "unverified" }),
}));

onAccountReset(() => useAddressVerificationStore.getState().reset());
