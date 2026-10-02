import { create } from "zustand";

import type { SwitchPlan } from "../utils/accountRegistry";

/**
 * What the person is in the middle of doing between logging out of one account
 * and signing in to the next: switching to a known account, or adding another.
 *
 * It lives in memory only, on purpose. The sign-in screen is reachable before
 * anyone has authenticated, so nothing about the accounts on this phone may be
 * shown there except the one the person has just chosen to switch to.
 */
export interface SwitchTarget {
  accountKey: string;
  /** The private name, as the person will recognize it. */
  label: string;
  handle: string | null;
  privyUserId: string | null;
  plan: SwitchPlan;
}

export type AccountIntent =
  | { kind: "switch"; target: SwitchTarget }
  | { kind: "add" };

interface AccountSwitchState {
  intent: AccountIntent | null;
  begin: (intent: AccountIntent) => void;
  clear: () => void;
}

export const useAccountSwitchStore = create<AccountSwitchState>((set) => ({
  intent: null,
  begin: (intent) => set({ intent }),
  clear: () => set({ intent: null }),
}));
