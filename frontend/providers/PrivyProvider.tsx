import { PrivyElements } from "@privy-io/expo/ui";
import Constants from "expo-constants";
import { base, baseSepolia } from "viem/chains";
import { PrivyProvider as ExpoPrivyProvider } from "@privy-io/expo";

import { embeddedWalletConfig } from "@/utils/privyConfig";

const readPublicValue = (value?: string) => value?.trim() || undefined;

// Keep the Privy application and its native client selected by the EAS build
// profile. Hard-coding either value here can silently point a store build at a
// different Privy dashboard application than the one holding its iOS/Android
// identifiers and Android signing hashes.
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

if (!privyAppId || !privyClientId) {
  throw new Error("Missing Privy App ID or native App Client ID");
}

if (privyAppId === privyClientId) {
  throw new Error(
    "Invalid Privy configuration: App ID and native App Client ID must be different values.",
  );
}

const selectedChain =
  process.env.EXPO_PUBLIC_NETWORK === "base-mainnet" ? base : baseSepolia;

// Shared with the passkey sign-in in services/passkey.service.ts, which must
// hand Privy the same embedded-wallet setting the SDK's own hook would.
const privyConfig = { embedded: embeddedWalletConfig };

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
