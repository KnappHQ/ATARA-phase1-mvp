import type { ComponentType, ErrorInfo, ReactNode } from "react";
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { EthereumSignerWallet } from "@/services/smartAccount.service";
import {
  forgetExternalWalletSession,
  shouldRestoreExternalWalletSession,
} from "@/utils/externalWalletSession";

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
  onValue: (value: ExternalWalletContextValue) => void;
  onError: (error: unknown) => void;
};

type PendingConnect = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

type WalletRuntimeBoundaryProps = {
  children: ReactNode;
  onError: (error: unknown, info?: ErrorInfo) => void;
};

class WalletRuntimeBoundary extends Component<
  WalletRuntimeBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError(error, info);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID?.trim() || "";

const asError = (error: unknown) =>
  error instanceof Error
    ? error
    : new Error("Le module de connexion wallet n'a pas pu démarrer.");

export const ExternalWalletProvider = ({ children }: { children: ReactNode }) => {
  const [Runtime, setRuntime] =
    useState<ComponentType<RuntimeProps> | null>(null);
  const [runtimeValue, setRuntimeValue] =
    useState<ExternalWalletContextValue | null>(null);
  const runtimeComponentRef = useRef<ComponentType<RuntimeProps> | null>(null);
  const runtimeValueRef = useRef<ExternalWalletContextValue | null>(null);
  const runtimeLoadingRef = useRef(false);
  const pendingConnectRef = useRef<PendingConnect | null>(null);

  const handleRuntimeError = useCallback(
    (error: unknown, info?: ErrorInfo) => {
      const runtimeError = asError(error);
      const pending = pendingConnectRef.current;
      pendingConnectRef.current = null;
      pending?.reject(runtimeError);

      runtimeComponentRef.current = null;
      runtimeValueRef.current = null;
      runtimeLoadingRef.current = false;
      setRuntime(null);
      setRuntimeValue(null);
      void forgetExternalWalletSession().catch(() => undefined);

      console.warn(
        "Reown wallet runtime stopped safely:",
        runtimeError.message,
        info?.componentStack || "",
      );
    },
    [],
  );

  const loadRuntime = useCallback(() => {
    if (runtimeComponentRef.current || runtimeLoadingRef.current) return;

    runtimeLoadingRef.current = true;
    try {
      // Reown remains outside the normal launch path for most users. It is
      // loaded after an explicit wallet action, or only for a stored Reown
      // session that may be restored without reopening the connection modal.
      const module = require("./ReownExternalWalletRuntime") as {
        ReownExternalWalletRuntime: ComponentType<RuntimeProps>;
      };
      runtimeComponentRef.current = module.ReownExternalWalletRuntime;
      setRuntime(() => module.ReownExternalWalletRuntime);
    } catch (error) {
      handleRuntimeError(error);
      throw asError(error);
    } finally {
      runtimeLoadingRef.current = false;
    }
  }, [handleRuntimeError]);

  const handleRuntimeValue = useCallback(
    (value: ExternalWalletContextValue) => {
      runtimeValueRef.current = value;
      setRuntimeValue(value);

      const pending = pendingConnectRef.current;
      if (!pending) return;

      pendingConnectRef.current = null;
      void Promise.resolve()
        .then(() => value.connect())
        .then(pending.resolve)
        .catch((error) => pending.reject(asError(error)));
    },
    [],
  );

  const connect = useCallback(async () => {
    if (!projectId) {
      throw new Error("La connexion par wallet attend la configuration Reown.");
    }

    const current = runtimeValueRef.current;
    if (current) {
      await current.connect();
      return;
    }

    if (pendingConnectRef.current) {
      await pendingConnectRef.current.promise;
      return;
    }

    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    const pending = { promise, resolve, reject };
    pendingConnectRef.current = pending;

    try {
      loadRuntime();
    } catch (error) {
      if (pendingConnectRef.current === pending) {
        pendingConnectRef.current = null;
        pending.reject(asError(error));
      }
    }

    await promise;
  }, [loadRuntime]);

  const disconnect = useCallback(async () => {
    const current = runtimeValueRef.current;
    try {
      if (current) await current.disconnect();
    } finally {
      await forgetExternalWalletSession();
    }
  }, []);

  const ensureSupportedNetwork = useCallback(async () => {
    const current = runtimeValueRef.current;
    if (!current?.isConnected) {
      throw new Error("Ton wallet externe n'est plus connecté.");
    }
    await current.ensureSupportedNetwork();
  }, []);

  useEffect(() => {
    let active = true;

    void shouldRestoreExternalWalletSession()
      .then((shouldRestore) => {
        if (active && shouldRestore) loadRuntime();
      })
      .catch((error) =>
        console.warn("Stored wallet session could not be inspected:", error),
      );

    return () => {
      active = false;
    };
  }, [loadRuntime]);

  useEffect(
    () => () => {
      const pending = pendingConnectRef.current;
      pendingConnectRef.current = null;
      pending?.reject(new Error("La connexion wallet a été interrompue."));
    },
    [],
  );

  const value = useMemo<ExternalWalletContextValue>(
    () => ({
      enabled: Boolean(projectId),
      isConnected: runtimeValue?.isConnected ?? false,
      address: runtimeValue?.address,
      chainId: runtimeValue?.chainId,
      wallet: runtimeValue?.wallet,
      connect,
      disconnect,
      ensureSupportedNetwork,
    }),
    [connect, disconnect, ensureSupportedNetwork, runtimeValue],
  );

  return (
    <ExternalWalletContext.Provider value={value}>
      {children}
      {Runtime && (
        <WalletRuntimeBoundary onError={handleRuntimeError}>
          <Runtime
            onValue={handleRuntimeValue}
            onError={handleRuntimeError}
          />
        </WalletRuntimeBoundary>
      )}
    </ExternalWalletContext.Provider>
  );
};

export const useExternalWallet = () => useContext(ExternalWalletContext);
