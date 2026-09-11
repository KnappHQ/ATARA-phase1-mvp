import { PrivyElements } from "@privy-io/expo/ui";
import { base, baseSepolia } from "viem/chains";
import { PrivyProvider as ExpoPrivyProvider } from "@privy-io/expo";

const PRIVY_APP_ID = "cmql9uzpi00p60cky8jr0stcw";
const PRIVY_CLIENT_ID =
  "client-WY6aSgVTdkUNG9eQoZ7YaufEnNBLkyyRregx2qH1ui4nf";

const selectedChain =
  process.env.EXPO_PUBLIC_NETWORK === "base-mainnet" ? base : baseSepolia;

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
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
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
