import type { ComponentType, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { EthereumSignerWallet } from "@/services/smartAccount.service";

export type ExternalWalletContextValue = {
  enabled: boolean;
  isConnected: boolean;
  address?: string;
  chainId?: string;
  wallet?: EthereumSignerWallet;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  ensureSupportedNetwork: () => Promise<void>;
};

export const ExternalWalletContext = createContext<ExternalWalletContextValue>({
  enabled: false,
  isConnected: false,
  connect: async () => {
    throw new Error("La connexion par wallet n'est pas disponible.");
  },
  disconnect: async () => undefined,
  ensureSupportedNetwork: async () => undefined,
});

type RuntimeProps = {
  children: ReactNode;
  autoConnect?: boolean;
};

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID?.trim() || "";

export const ExternalWalletProvider = ({ children }: { children: ReactNode }) => {
  const [Runtime, setRuntime] =
    useState<ComponentType<RuntimeProps> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRuntime = useCallback(async () => {
    if (Runtime) return;
    try {
      // Keep Reown out of the app-launch path. Native wallet modules are loaded
      // only when the user explicitly asks to connect an external wallet.
      const module = require("./ReownExternalWalletRuntime") as {
        ReownExternalWalletRuntime: ComponentType<RuntimeProps>;
      };
      setRuntime(() => module.ReownExternalWalletRuntime);
      setLoadError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wallet module unavailable";
      console.warn("Reown runtime failed to load:", message);
      setLoadError(message);
      throw error;
    }
  }, [Runtime]);

  const connect = useCallback(async () => {
    if (!projectId) {
      throw new Error("La connexion par wallet attend la configuration Reown.");
    }
    await loadRuntime();
  }, [loadRuntime]);

  const fallbackValue = useMemo<ExternalWalletContextValue>(
    () => ({
      enabled: Boolean(projectId) && !loadError,
      isConnected: false,
      connect,
      disconnect: async () => undefined,
      ensureSupportedNetwork: async () => undefined,
    }),
    [connect, loadError],
  );

  if (Runtime) {
    return <Runtime autoConnect>{children}</Runtime>;
  }

  return (
    <ExternalWalletContext.Provider value={fallbackValue}>
      {children}
    </ExternalWalletContext.Provider>
  );
};

export const useExternalWallet = () => useContext(ExternalWalletContext);
