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
  useAppKitState,
  useProvider,
} from "@reown/appkit-react-native";
import { EthersAdapter } from "@reown/appkit-ethers-react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { waitForExternalConnection } from "@/utils/externalWalletConnection";
import { withTimeout } from "@/utils/asyncOperation";

import type { ExternalWalletContextValue } from "@/providers/ExternalWalletProvider";
import type { EthereumSignerWallet } from "@/services/smartAccount.service";
import {
  forgetExternalWalletSession,
  rememberExternalWalletSession,
} from "@/utils/externalWalletSession";
import { APP_NETWORK, CHAIN_ID } from "@/utils/constants";

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID?.trim() || "";
const STORAGE_PREFIX = "@atara/reown/";
const storageKey = (key: string) => STORAGE_PREFIX + key;

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
    const siteUrl =
      process.env.EXPO_PUBLIC_SITE_URL || "https://atara.finance";

    return createAppKit({
      projectId,
      metadata: {
        name: "ATARA",
        description: "A self-custodial social wallet for people and groups.",
        url: siteUrl,
        icons: [siteUrl + "/icon.png"],
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
  onValue,
}: {
  onValue: (value: ExternalWalletContextValue) => void;
}) => {
  const { address, isConnected, chainId } = useAccount();
  const { provider, providerType } = useProvider();
  const { open, close, disconnect, switchNetwork } = useAppKit();
  const { isOpen } = useAppKitState();
  const connectionRef = useRef({ isOpen, isConnected, hasProvider: !!provider });
  connectionRef.current = { isOpen, isConnected, hasProvider: !!provider };
  const attemptRef = useRef<AbortController | null>(null);

  useEffect(() => () => attemptRef.current?.abort(), []);

  const connect = useCallback(async () => {
    if (attemptRef.current) throw new Error("Une connexion wallet est déjà en cours.");
    const attempt = new AbortController();
    attemptRef.current = attempt;
    try {
      open({ view: "Connect" });
      await waitForExternalConnection(() => connectionRef.current, attempt.signal);
      await close();
    } catch (error) {
      await withTimeout(close(), 3_000).catch(() => undefined);
      throw error;
    } finally {
      if (attemptRef.current === attempt) attemptRef.current = null;
    }
  }, [open, close]);

  const disconnectWallet = useCallback(async () => {
    attemptRef.current?.abort();
    try {
      await close();
      await disconnect("eip155");
    } finally {
      await forgetExternalWalletSession();
    }
  }, [disconnect, close]);

  const ensureSupportedNetwork = useCallback(async () => {
    if (!provider) throw new Error("Le fournisseur du wallet n'est pas encore prêt.");
    const currentChainId = Number(await withTimeout(provider.request({ method: "eth_chainId" })));

    if (!Number.isFinite(currentChainId)) {
      throw new Error("Le réseau du wallet n'est pas encore disponible.");
    }

    if (currentChainId !== CHAIN_ID) {
      await withTimeout(switchNetwork(baseNetwork), 60_000);
      const confirmedChain = Number(await withTimeout(provider.request({ method: "eth_chainId" })));
      if (confirmedChain !== CHAIN_ID) throw new Error("Le wallet n’a pas confirmé le réseau Base attendu.");
    }
  }, [provider, switchNetwork]);

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

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  useEffect(() => {
    if (isConnected) {
      void rememberExternalWalletSession().catch((error) =>
        console.warn("Wallet restore marker could not be saved:", error),
      );
    }
  }, [isConnected]);

  return <AppKit modalContentWrapper={WalletModalContent} />;
};

const WalletModalContent = ({ children }: { children: React.ReactNode }) => (
  <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
);

const RuntimeUnavailable = ({
  onError,
}: {
  onError: (error: unknown) => void;
}) => {
  useEffect(() => {
    onError(new Error("Reown n'a pas pu être initialisé."));
  }, [onError]);

  return null;
};

export const ReownExternalWalletRuntime = ({
  onValue,
  onError,
}: {
  onValue: (value: ExternalWalletContextValue) => void;
  onError: (error: unknown) => void;
}) => {
  if (!appKit) return <RuntimeUnavailable onError={onError} />;

  return (
    <AppKitProvider instance={appKit}>
      <ConfiguredRuntime onValue={onValue} />
    </AppKitProvider>
  );
};
