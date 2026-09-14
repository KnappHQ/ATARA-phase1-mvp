import AsyncStorage from "@react-native-async-storage/async-storage";

const RESTORE_EXTERNAL_WALLET_KEY =
  "@atara/external-wallet/restore-connected-session";

export const shouldRestoreExternalWalletSession = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(RESTORE_EXTERNAL_WALLET_KEY)) === "connected";

export const rememberExternalWalletSession = async (): Promise<void> => {
  await AsyncStorage.setItem(RESTORE_EXTERNAL_WALLET_KEY, "connected");
};

export const forgetExternalWalletSession = async (): Promise<void> => {
  await AsyncStorage.removeItem(RESTORE_EXTERNAL_WALLET_KEY);
};
