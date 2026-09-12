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
  useLoginWithOAuth,
  usePrivy,
} from "@privy-io/expo";
import {
  useLoginWithPasskey,
  useSignupWithPasskey,
} from "@privy-io/expo/passkey";
import * as Haptics from "expo-haptics";

import { retryPendingSettlements } from "@/services/settlementRecovery.service";
import { registerUnauthorizedHandler } from "@/services/api";
import { AuthService } from "@/services/auth.service";
import {
  createAlchemySmartAccountService,
  type EthereumSignerWallet,
} from "@/services/smartAccount.service";
import { useExternalWallet } from "@/providers/ExternalWalletProvider";
import {
  describeAuthFailure,
  formatAuthFailure,
} from "@/utils/authDiagnostics";
import { useAlertStore } from "@/stores/useAlertStore";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  getPrimaryEmailAddress,
  getPrimaryEmbeddedEthereumWalletAddress,
  getPrimaryOAuthProvider,
} from "@/utils/privy";

type OnboardingStep = "gate" | "identity";
type OAuthProvider = "google" | "apple";
type AuthMethod = "privy" | "external_wallet";

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
  isExternalWalletEnabled: boolean;
  startPasskey: (mode: "login" | "signup") => Promise<void>;
  startExternalWallet: () => Promise<void>;
  startOAuth: (provider: OAuthProvider) => Promise<void>;
  registerWithHandle: (params: RegisterWithHandleParams) => Promise<void>;
  checkHandle: (handle: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ONBOARDING_TRANSITION_MS = 600;

const signPersonalMessage = async (
  wallet: EthereumSignerWallet,
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
  wallets: EthereumSignerWallet[],
  address?: string,
): EthereumSignerWallet | undefined => {
  if (!address) return undefined;

  return wallets.find(
    (wallet) => wallet.address.toLowerCase() === address.toLowerCase(),
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, isReady: isPrivyReady, logout: privyLogout } = usePrivy();
  const { wallets, create } = useEmbeddedEthereumWallet();
  const { login: loginWithOAuth, state: oauthState } = useLoginWithOAuth();
  const { loginWithPasskey } = useLoginWithPasskey();
  const { signupWithPasskey } = useSignupWithPasskey();
  const externalWallet = useExternalWallet();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("gate");
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const [activeAuthMethod, setActiveAuthMethod] = useState<AuthMethod>("privy");
  const ignoredAutoLoginUserIdRef = useRef<string | null>(null);
  const autoLoginKeyRef = useRef<string | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const embeddedWallets = wallets as EthereumSignerWallet[];
  // A valid backend session is enough to read ATARA data. Requiring a live
  // Privy session here would make wallet-only users depend on a social-login
  // provider even after proving ownership with their wallet.
  const isReady = hasLoadedSession && !isAuthLoading;
  const isFullyAuthenticated = isAuthenticated;

  useEffect(() => {
    if (externalWallet.isConnected && !user) {
      setActiveAuthMethod("external_wallet");
    }
  }, [externalWallet.isConnected, user]);

  useEffect(() => { if (isFullyAuthenticated) void retryPendingSettlements().catch(() => {}); }, [isFullyAuthenticated]);

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
      await externalWallet.disconnect().catch(() => undefined);
      await useAuthStore.getState().logout();
      setOnboardingStep("gate");
      autoLoginKeyRef.current = null;
      ignoredAutoLoginUserIdRef.current = null;
    }
  }, [externalWallet, privyLogout]);

  const startOAuth = useCallback(
    async (provider: OAuthProvider) => {
      setIsStartingOAuth(true);
      setOauthError(null);
      setActiveAuthMethod("privy");
      ignoredAutoLoginUserIdRef.current = null;

      if (useAuthStore.getState().justLoggedOut) {
        await useAuthStore.getState().clearJustLoggedOut();
      }

      try {
        await loginWithOAuth({
          provider,
          redirectUri: "/oauth-callback",
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        setOauthError(
          formatAuthFailure(describeAuthFailure(error, { method: "oauth" })),
        );
      } finally {
        setIsStartingOAuth(false);
      }
    },
    [loginWithOAuth],
  );

  const startPasskey = useCallback(async (mode: "login" | "signup") => {
    const relyingParty = process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
    if (!relyingParty) { setOauthError("La connexion par passkey attend la configuration du domaine."); return; }
    setIsStartingOAuth(true); setOauthError(null); setActiveAuthMethod("privy"); ignoredAutoLoginUserIdRef.current = null;
    await useAuthStore.getState().clearJustLoggedOut();
    try {
      const input = { relyingParty: `https://${relyingParty}` };
      if (mode === "signup") await signupWithPasskey(input);
      else await loginWithPasskey(input);
    }
    catch (error) {
      // A bare provider string ("Signup with passkey not allowed") says nothing
      // about which system refused or what to change, and a store build has no
      // console to dig further.
      setOauthError(
        formatAuthFailure(describeAuthFailure(error, { method: "passkey" })),
      );
    }
    finally { setIsStartingOAuth(false); }
  }, [loginWithPasskey, signupWithPasskey]);

  const startExternalWallet = useCallback(async () => {
    setOauthError(null);
    setActiveAuthMethod("external_wallet");
    ignoredAutoLoginUserIdRef.current = null;
    await useAuthStore.getState().clearJustLoggedOut();
    try {
      if (externalWallet.isConnected) {
        await externalWallet.disconnect();
      }
      await externalWallet.connect();
    } catch (error) {
      setOauthError(
        formatAuthFailure(describeAuthFailure(error, { method: "wallet" })),
      );
    }
  }, [externalWallet]);

  const registerWithHandle = useCallback(
    async ({ handle }: RegisterWithHandleParams) => {
      const useConnectedWallet =
        activeAuthMethod === "external_wallet" && !!externalWallet.wallet;
      let signerWallet: EthereumSignerWallet | undefined = useConnectedWallet
        ? externalWallet.wallet
        : embeddedWallets[0];
      let signerAddress = useConnectedWallet
        ? externalWallet.address
        : signerWallet?.address || getPrimaryEmbeddedEthereumWalletAddress(user);

      if (!signerAddress && !useConnectedWallet) {
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

      if (useConnectedWallet) {
        await externalWallet.ensureSupportedNetwork();
      }

      const smartAccountService = await createAlchemySmartAccountService({
        wallet: signerWallet,
      });
      const smartAccountAddress = smartAccountService.getSmartAccountAddress();

      if (!smartAccountAddress) {
        throw new Error("Smart account not ready. Please try again.");
      }

      const challenge = await AuthService.requestChallenge(
        signerAddress,
        "register",
      );
      const registrationSignature = await signPersonalMessage(
        signerWallet,
        challenge.message,
      );

      if (!registrationSignature) {
        throw new Error("Failed to verify wallet ownership. Please try again.");
      }

      await AuthService.register({
        handle,
        smartAccountAddress,
        signerAddress,
        email: getPrimaryEmailAddress(user) || undefined,
        authProvider: useConnectedWallet
          ? "external_wallet"
          : getPrimaryOAuthProvider(user) ?? "passkey",
        message: challenge.message,
        signature: registrationSignature,
      });

      playAuthenticatedTransition(Haptics.ImpactFeedbackStyle.Medium);
    },
    [
      activeAuthMethod,
      create,
      embeddedWallets,
      externalWallet.address,
      externalWallet.ensureSupportedNetwork,
      externalWallet.wallet,
      playAuthenticatedTransition,
      user,
    ],
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
      isExternalWalletEnabled: externalWallet.enabled,
      startOAuth,
      startPasskey,
      startExternalWallet,
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
      startPasskey,
      startExternalWallet,
      externalWallet.enabled,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthenticationManager
        embeddedWallets={embeddedWallets}
        externalWallet={externalWallet.wallet}
        externalWalletConnected={externalWallet.isConnected}
        ensureExternalWalletNetwork={externalWallet.ensureSupportedNetwork}
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
  embeddedWallets: EthereumSignerWallet[];
  externalWallet?: EthereumSignerWallet;
  externalWalletConnected: boolean;
  ensureExternalWalletNetwork: () => Promise<void>;
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
  externalWallet,
  externalWalletConnected,
  ensureExternalWalletNetwork,
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
    if (
      !isPrivyReady ||
      !hasLoadedSession ||
      !user ||
      externalWalletConnected
    ) return;

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
    externalWalletConnected,
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

  useEffect(() => {
    if (
      !hasLoadedSession ||
      isAuthenticated ||
      !externalWalletConnected ||
      !externalWallet
    ) {
      return;
    }

    if (justLoggedOut) return;

    const autoLoginKey = `external-wallet:${externalWallet.address.toLowerCase()}`;
    if (autoLoginKeyRef.current === autoLoginKey) return;

    autoLoginKeyRef.current = autoLoginKey;
    onCheckingBackendChange(true);

    ensureExternalWalletNetwork()
      .then(() =>
        AuthService.loginWithSigner(externalWallet.address, (message) =>
          signPersonalMessage(externalWallet, message),
        ),
      )
      .then(() => {
        if (autoLoginKeyRef.current === autoLoginKey) onAuthenticated();
      })
      .catch((error: any) => {
        if (autoLoginKeyRef.current !== autoLoginKey) return;
        if (error?.response?.status === 404) {
          onOnboardingStepChange("identity");
        } else {
          showAuthError(
            "Connexion wallet incomplète",
            error?.message || "Vérifie le réseau Base et réessaie.",
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
    autoLoginKeyRef,
    ensureExternalWalletNetwork,
    externalWallet,
    externalWalletConnected,
    hasLoadedSession,
    isAuthenticated,
    justLoggedOut,
    onAuthenticated,
    onCheckingBackendChange,
    onOnboardingStepChange,
    showAuthError,
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
