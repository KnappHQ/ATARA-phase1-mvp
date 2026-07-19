import {
  createContext,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useEmbeddedEthereumWallet,
  useOAuthFlow,
  usePrivy,
} from "@privy-io/expo";
import * as Haptics from "expo-haptics";

import { registerUnauthorizedHandler } from "@/services/api";
import { AuthService } from "@/services/auth.service";
import {
  createAlchemySmartAccountService,
  type PrivyEthereumWallet,
} from "@/services/smartAccount.service";
import { useAlertStore } from "@/stores/useAlertStore";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  generateRegistrationMessage,
  getPrimaryEmailAddress,
  getPrimaryEmbeddedEthereumWalletAddress,
  getPrimaryOAuthProvider,
} from "@/utils/privy";

type OnboardingStep = "gate" | "identity";
type OAuthProvider = "google" | "apple";

type RegisterWithHandleParams = {
  handle: string;
};

type AuthContextValue = {
  isReady: boolean;
  isFullyAuthenticated: boolean;
  isAuthTransitioning: boolean;
  onboardingStep: OnboardingStep;
  isCheckingBackend: boolean;
  isStartingOAuth: boolean;
  oauthError: string | null;
  startOAuth: (provider: OAuthProvider) => Promise<void>;
  registerWithHandle: (params: RegisterWithHandleParams) => Promise<void>;
  checkHandle: (handle: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ONBOARDING_TRANSITION_MS = 600;

const signPersonalMessage = async (
  wallet: PrivyEthereumWallet,
  message: string,
): Promise<string> => {
  const provider = await wallet.getProvider();
  const signature = await provider.request({
    method: "personal_sign",
    params: [message, wallet.address],
  });

  return typeof signature === "string" ? signature : "";
};

const findWalletByAddress = (
  wallets: PrivyEthereumWallet[],
  address?: string,
): PrivyEthereumWallet | undefined => {
  if (!address) return undefined;

  return wallets.find(
    (wallet) => wallet.address.toLowerCase() === address.toLowerCase(),
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, isReady: isPrivyReady, logout: privyLogout } = usePrivy();
  const { wallets, create } = useEmbeddedEthereumWallet();
  const { start, state: oauthState } = useOAuthFlow();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("gate");
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const ignoredAutoLoginUserIdRef = useRef<string | null>(null);
  const autoLoginKeyRef = useRef<string | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const embeddedWallets = wallets as PrivyEthereumWallet[];
  const isReady = isPrivyReady && hasLoadedSession && !isAuthLoading;
  const isFullyAuthenticated = isPrivyReady && !!user && isAuthenticated;

  const handleSessionLoaded = useCallback(() => {
    setHasLoadedSession(true);
  }, []);

  const playAuthenticatedTransition = useCallback(
    (style: Haptics.ImpactFeedbackStyle) => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      setIsAuthTransitioning(true);
      Haptics.impactAsync(style);
      transitionTimeoutRef.current = setTimeout(() => {
        setIsAuthTransitioning(false);
      }, ONBOARDING_TRANSITION_MS);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await privyLogout();
    } catch (error) {
      console.warn("Privy logout failed:", error);
    } finally {
      await useAuthStore.getState().logout();
      setOnboardingStep("gate");
      autoLoginKeyRef.current = null;
      ignoredAutoLoginUserIdRef.current = null;
    }
  }, [privyLogout]);

  const startOAuth = useCallback(
    async (provider: OAuthProvider) => {
      setIsStartingOAuth(true);
      setOauthError(null);
      ignoredAutoLoginUserIdRef.current = null;

      if (useAuthStore.getState().justLoggedOut) {
        await useAuthStore.getState().clearJustLoggedOut();
      }

      try {
        await start({
          provider,
          redirectUri: "/oauth-callback",
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        setOauthError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsStartingOAuth(false);
      }
    },
    [start],
  );

  const registerWithHandle = useCallback(
    async ({ handle }: RegisterWithHandleParams) => {
      let signerWallet: PrivyEthereumWallet | undefined = embeddedWallets[0];
      let signerAddress =
        signerWallet?.address || getPrimaryEmbeddedEthereumWalletAddress(user);

      if (!signerAddress) {
        const result = await create({ createAdditional: false });
        signerAddress =
          getPrimaryEmbeddedEthereumWalletAddress(result.user) ||
          getPrimaryEmbeddedEthereumWalletAddress(user);
        signerWallet = findWalletByAddress(embeddedWallets, signerAddress);
      }

      if (!signerAddress) {
        throw new Error("Wallet not ready. Please wait...");
      }

      if (!signerWallet) {
        throw new Error(
          "Wallet provider not ready. Please try again in a moment.",
        );
      }

      const smartAccountService = await createAlchemySmartAccountService({
        wallet: signerWallet,
      });
      const smartAccountAddress = smartAccountService.getSmartAccountAddress();

      if (!smartAccountAddress) {
        throw new Error("Smart account not ready. Please try again.");
      }

      const registrationMessage = generateRegistrationMessage(signerAddress);
      const registrationSignature = await signPersonalMessage(
        signerWallet,
        registrationMessage,
      );

      if (!registrationSignature) {
        throw new Error("Failed to verify wallet ownership. Please try again.");
      }

      await AuthService.register({
        handle,
        smartAccountAddress,
        signerAddress,
        email: getPrimaryEmailAddress(user) || undefined,
        authProvider: getPrimaryOAuthProvider(user) ?? "privy",
        message: registrationMessage,
        signature: registrationSignature,
      });

      playAuthenticatedTransition(Haptics.ImpactFeedbackStyle.Medium);
    },
    [create, embeddedWallets, playAuthenticatedTransition, user],
  );

  const checkHandle = useCallback((handle: string) => {
    return AuthService.checkHandle(handle);
  }, []);

  const handleAuthenticated = useCallback(() => {
    playAuthenticatedTransition(Haptics.ImpactFeedbackStyle.Heavy);
  }, [playAuthenticatedTransition]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isFullyAuthenticated,
      isAuthTransitioning,
      onboardingStep,
      isCheckingBackend,
      isStartingOAuth: isStartingOAuth || oauthState.status === "loading",
      oauthError,
      startOAuth,
      registerWithHandle,
      checkHandle,
      logout,
    }),
    [
      checkHandle,
      isAuthTransitioning,
      isCheckingBackend,
      isFullyAuthenticated,
      isReady,
      isStartingOAuth,
      logout,
      oauthError,
      oauthState.status,
      onboardingStep,
      registerWithHandle,
      startOAuth,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthenticationManager
        embeddedWallets={embeddedWallets}
        hasLoadedSession={hasLoadedSession}
        ignoredAutoLoginUserIdRef={ignoredAutoLoginUserIdRef}
        autoLoginKeyRef={autoLoginKeyRef}
        onSessionLoaded={handleSessionLoaded}
        onCheckingBackendChange={setIsCheckingBackend}
        onOnboardingStepChange={setOnboardingStep}
        onAuthenticated={handleAuthenticated}
        logout={logout}
      />
      {children}
    </AuthContext.Provider>
  );
};

type AuthenticationManagerProps = {
  embeddedWallets: PrivyEthereumWallet[];
  hasLoadedSession: boolean;
  ignoredAutoLoginUserIdRef: MutableRefObject<string | null>;
  autoLoginKeyRef: MutableRefObject<string | null>;
  onSessionLoaded: () => void;
  onCheckingBackendChange: (isChecking: boolean) => void;
  onOnboardingStepChange: (step: OnboardingStep) => void;
  onAuthenticated: () => void;
  logout: () => Promise<void>;
};

const AuthenticationManager = ({
  embeddedWallets,
  hasLoadedSession,
  ignoredAutoLoginUserIdRef,
  autoLoginKeyRef,
  onSessionLoaded,
  onCheckingBackendChange,
  onOnboardingStepChange,
  onAuthenticated,
  logout,
}: AuthenticationManagerProps) => {
  const { user, isReady: isPrivyReady } = usePrivy();
  const { isAuthenticated, justLoggedOut } = useAuthStore();
  const showAuthError = useAlertStore((state) => state.error);

  useEffect(() => {
    let mounted = true;

    registerUnauthorizedHandler(logout);
    useAuthStore
      .getState()
      .loadSession()
      .finally(() => {
        if (mounted) {
          onSessionLoaded();
        }
      });

    return () => {
      mounted = false;
    };
  }, [logout, onSessionLoaded]);

  useEffect(() => {
    if (!isPrivyReady || !hasLoadedSession || !user) return;

    if (justLoggedOut) {
      ignoredAutoLoginUserIdRef.current = user.id;
      useAuthStore.getState().clearJustLoggedOut();
      return;
    }

    if (isAuthenticated) return;

    if (ignoredAutoLoginUserIdRef.current === user.id) {
      return;
    }

    const signerAddress = getPrimaryEmbeddedEthereumWalletAddress(user);

    if (!signerAddress) {
      onOnboardingStepChange("identity");
      return;
    }

    const autoLoginKey = `${user.id}:${signerAddress}`;
    if (autoLoginKeyRef.current === autoLoginKey) {
      return;
    }

    const signerWallet = findWalletByAddress(embeddedWallets, signerAddress);

    if (!signerWallet) {
      onOnboardingStepChange("identity");
      return;
    }

    autoLoginKeyRef.current = autoLoginKey;
    onCheckingBackendChange(true);

    AuthService.loginWithSigner(signerAddress, (message) =>
      signPersonalMessage(signerWallet, message),
    )
      .then(() => {
        if (autoLoginKeyRef.current === autoLoginKey) {
          onAuthenticated();
        }
      })
      .catch((error: any) => {
        if (autoLoginKeyRef.current !== autoLoginKey) return;

        if (error?.response?.status === 404) {
          onOnboardingStepChange("identity");
        } else {
          showAuthError(
            "Sign in failed",
            "Please check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (autoLoginKeyRef.current === autoLoginKey) {
          autoLoginKeyRef.current = null;
          onCheckingBackendChange(false);
        }
      });
  }, [
    embeddedWallets,
    hasLoadedSession,
    ignoredAutoLoginUserIdRef,
    isAuthenticated,
    isPrivyReady,
    justLoggedOut,
    autoLoginKeyRef,
    onAuthenticated,
    onCheckingBackendChange,
    onOnboardingStepChange,
    showAuthError,
    user,
  ]);

  return null;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
