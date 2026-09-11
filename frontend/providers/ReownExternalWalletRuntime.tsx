import "@walletconnect/react-native-compat";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppKit,
  AppKitProvider,
  createAppKit,
  type AppKitNetwork,
  type Storage,
  useAccount,
  useAppKit,
  useProvider,
} from "@reown/appkit-react-native";
import { EthersAdapter } from "@reown/appkit-ethers-react-native";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from "react";

import {
  ExternalWalletContext,
  type ExternalWalletContextValue,
} from "@/providers/ExternalWalletProvider";
import type { EthereumSignerWallet } from "@/services/smartAccount.service";
import { APP_NETWORK, CHAIN_ID } from "@/utils/constants";

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID?.trim() || "";
const STORAGE_PREFIX = "@atara/reown/";
const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`;

const baseNetwork: AppKitNetwork = {
  id: CHAIN_ID,
  name: APP_NETWORK === "base-mainnet" ? "Base" : "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        APP_NETWORK === "base-mainnet"
          ? "https://mainnet.base.org"
          : "https://sepolia.base.org",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url:
        APP_NETWORK === "base-mainnet"
          ? "https://basescan.org"
          : "https://sepolia.basescan.org",
    },
  },
  chainNamespace: "eip155",
  caipNetworkId: `eip155:${CHAIN_ID}`,
  testnet: APP_NETWORK !== "base-mainnet",
};

const storage: Storage = {
  getKeys: () =>
    AsyncStorage.getAllKeys().then((keys) =>
      keys
        .filter((key) => key.startsWith(STORAGE_PREFIX))
        .map((key) => key.slice(STORAGE_PREFIX.length)),
    ),
  getEntries: async <T,>() => {
    const keys = await storage.getKeys();
    const entries = await AsyncStorage.multiGet(keys.map(storageKey));
    return entries.flatMap(([storedKey, value]) => {
      if (value === null) return [];
      const key = storedKey.slice(STORAGE_PREFIX.length);
      try {
        return [[key, JSON.parse(value) as T] as [string, T]];
      } catch {
        return [[key, value as T] as [string, T]];
      }
    });
  },
  getItem: async <T,>(key: string) => {
    const value = await AsyncStorage.getItem(storageKey(key));
    if (value === null) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },
  setItem: async <T,>(key: string, value: T) => {
    await AsyncStorage.setItem(storageKey(key), JSON.stringify(value));
  },
  removeItem: (key: string) => AsyncStorage.removeItem(storageKey(key)),
};

const createAtaraAppKit = () => {
  if (!projectId) return null;
  try {
    return createAppKit({
      projectId,
      metadata: {
        name: "ATARA",
        description: "A self-custodial social wallet for people and groups.",
        url: process.env.EXPO_PUBLIC_SITE_URL || "https://atara.finance",
        icons: [
          `${process.env.EXPO_PUBLIC_SITE_URL || "https://atara.finance"}/icon.png`,
        ],
        redirect: { native: "atara://" },
      },
      adapters: [new EthersAdapter()],
      networks: [baseNetwork],
      defaultNetwork: baseNetwork,
      storage,
      enableAnalytics: false,
      themeMode: "dark",
      themeVariables: { accent: "#3c83f6" },
      features: {
        onramp: false,
        swaps: false,
        socials: false,
        showWallets: true,
      },
    });
  } catch (error) {
    console.warn("Reown AppKit initialization failed:", error);
    return null;
  }
};

const appKit = createAtaraAppKit();

const ConfiguredRuntime = ({
  children,
  autoConnect,
}: {
  children: ReactNode;
  autoConnect?: boolean;
}) => {
  const { address, isConnected, chainId } = useAccount();
  const { provider, providerType } = useProvider();
  const { open, disconnect, switchNetwork } = useAppKit();

  const connect = useCallback(async () => {
    await open({ view: "Connect" });
  }, [open]);

  useEffect(() => {
    if (!autoConnect) return;
    const timer = setTimeout(() => {
      void connect().catch((error) =>
        console.warn("Reown connect failed:", error),
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [autoConnect, connect]);

  const disconnectWallet = useCallback(async () => {
    await disconnect("eip155");
  }, [disconnect]);

  const ensureSupportedNetwork = useCallback(async () => {
    if (chainId && Number(chainId) !== CHAIN_ID) {
      await switchNetwork(baseNetwork);
    }
  }, [chainId, switchNetwork]);

  const wallet = useMemo<EthereumSignerWallet | undefined>(() => {
    if (!address || !provider || providerType !== "eip155") return undefined;
    return {
      address,
      getProvider: async () => ({
        request: (args) => provider.request(args),
      }),
    };
  }, [address, provider, providerType]);

  const value = useMemo<ExternalWalletContextValue>(
    () => ({
      enabled: true,
      isConnected,
      address,
      chainId,
      wallet,
      connect,
      disconnect: disconnectWallet,
      ensureSupportedNetwork,
    }),
    [
      address,
      chainId,
      connect,
      disconnectWallet,
      ensureSupportedNetwork,
      isConnected,
      wallet,
    ],
  );

  return (
    <ExternalWalletContext.Provider value={value}>
      {children}
      <AppKit />
    </ExternalWalletContext.Provider>
  );
};

export const ReownExternalWalletRuntime = ({
  children,
  autoConnect,
}: {
  children: ReactNode;
  autoConnect?: boolean;
}) => {
  if (!appKit) {
    return (
      <ExternalWalletContext.Provider
        value={{
          enabled: false,
          isConnected: false,
          connect: async () => {
            throw new Error("Reown n'a pas pu être initialisé.");
          },
          disconnect: async () => undefined,
          ensureSupportedNetwork: async () => undefined,
        }}
      >
        {children}
      </ExternalWalletContext.Provider>
    );
  }

  return (
    <AppKitProvider instance={appKit}>
      <ConfiguredRuntime autoConnect={autoConnect}>
        {children}
      </ConfiguredRuntime>
    </AppKitProvider>
  );
};
