import { PrivyElements } from "@privy-io/expo/ui";
import Constants from "expo-constants";
import { base, baseSepolia } from "viem/chains";
import { PrivyProvider as ExpoPrivyProvider } from "@privy-io/expo";

const readPublicValue = (value?: string) => value?.trim() || undefined;

const privyAppId = readPublicValue(
  process.env.EXPO_PUBLIC_PRIVY_APP_ID ||
    (Constants.expoConfig?.extra?.EXPO_PUBLIC_PRIVY_APP_ID as
      | string
      | undefined),
);
const privyClientId = readPublicValue(
  process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ||
    (Constants.expoConfig?.extra?.EXPO_PUBLIC_PRIVY_CLIENT_ID as
      | string
      | undefined),
);

const selectedChain =
  process.env.EXPO_PUBLIC_NETWORK === "base-mainnet" ? base : baseSepolia;

if (!privyAppId) {
  throw new Error("Missing EXPO_PUBLIC_PRIVY_APP_ID");
}

if (!privyClientId) {
  throw new Error("Missing EXPO_PUBLIC_PRIVY_CLIENT_ID");
}

if (privyAppId === privyClientId) {
  throw new Error(
    "Invalid Privy configuration: App ID and mobile App Client ID must be different values.",
  );
}

if (/^(your-|replace-|changeme|example)/i.test(privyAppId)) {
  throw new Error("Invalid EXPO_PUBLIC_PRIVY_APP_ID placeholder value");
}

if (/^(your-|replace-|changeme|example)/i.test(privyClientId)) {
  throw new Error("Invalid EXPO_PUBLIC_PRIVY_CLIENT_ID placeholder value");
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
      <PrivyElements
        config={{
          appearance: { colorScheme: "dark", accentColor: "#dfccb1" },
          mfa: { enableMfaVerificationUIs: true },
          passkeys: { shouldUnlinkOnUnenrollMfa: false },
        }}
      />
    </ExpoPrivyProvider>
  );
};
