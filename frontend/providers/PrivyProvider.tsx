import Constants from "expo-constants";
import { base, baseSepolia } from "viem/chains";
import { PrivyProvider as ExpoPrivyProvider } from "@privy-io/expo";

const privyAppId =
  process.env.EXPO_PUBLIC_PRIVY_APP_ID ||
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_PRIVY_APP_ID as string | undefined);
const privyClientId =
  process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ||
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_PRIVY_CLIENT_ID as
    | string
    | undefined);

const selectedChain =
  process.env.EXPO_PUBLIC_NETWORK === "base-mainnet" ? base : baseSepolia;

if (!privyAppId) {
  throw new Error("Missing EXPO_PUBLIC_PRIVY_APP_ID");
}

if (!privyClientId) {
  throw new Error("Missing EXPO_PUBLIC_PRIVY_CLIENT_ID");
}

const privyConfig = {
  embedded: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
};

export const PrivyProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ExpoPrivyProvider
      appId={privyAppId}
      clientId={privyClientId}
      supportedChains={[selectedChain]}
      config={privyConfig as any}
    >
      {children}
    </ExpoPrivyProvider>
  );
};
