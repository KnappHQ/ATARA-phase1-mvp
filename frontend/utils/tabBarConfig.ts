/**
 * What the bottom bar shows. Pay is a button in the middle of the bar, not a
 * tab: it opens the existing Send screen. Vault is postponed, so when it is
 * switched on the bar stays exactly as it was (Home, Activity, Vault, Profile).
 */
export type TabBarItemId = "home" | "activity" | "pay" | "groups" | "vaults" | "profile";

export const tabBarItems = (vaultsEnabled: boolean): TabBarItemId[] =>
  vaultsEnabled
    ? ["home", "activity", "vaults", "profile"]
    : ["home", "activity", "pay", "groups", "profile"];
