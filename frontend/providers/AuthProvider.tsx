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
  usePrivyClient,
} from "@privy-io/expo";
import { useLoginWithPasskey } from "@privy-io/expo/passkey";
import * as Haptics from "expo-haptics";
import { stringToHex } from "viem";

import { retryPendingSettlements } from "@/services/settlementRecovery.service";
import { flushRecordings } from "@/services/paymentOperations.runtime";
import { registerUnauthorizedHandler } from "@/services/api";
import { AuthService } from "@/services/auth.service";
import { assertActive, waitForWallet } from "@/utils/walletReadiness";
import { withTimeout } from "@/utils/asyncOperation";
import {
  createAlchemySmartAccountService,
  type EthereumSignerWallet,
} from "@/services/smartAccount.service";
import { useExternalWallet } from "@/providers/ExternalWalletProvider";
import {
  describeAuthFailure,
  formatAuthFailure,
  probeDomainAssociation,
} from "@/utils/authDiagnostics";
import {
  PasskeyFlowError,
  createNamedPasskey,
  signInWithPasskey,
} from "@/services/passkey.service";
import { createPasskeyDeps, randomBytes } from "@/services/passkeyRuntime";
import { checkAccountLabel, LABEL_ERROR_TEXT, suggestAccountLabel } from "@/utils/accountLabels";
import { labelsInUse, newAccountKey, passkeyNamesInUse } from "@/utils/accountRegistry";
import { checkLanding } from "@/services/accountActions";
import { listPasskeys, type UserLike } from "@/utils/loginMethods";
import { embeddedWalletConfig } from "@/utils/privyConfig";
import { useAccountRegistryStore, registryReady } from "@/stores/useAccountRegistryStore";
import { useAccountSwitchStore } from "@/stores/useAccountSwitchStore";
import { useAlertStore } from "@/stores/useAlertStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useTransactionHistoryStore } from "@/stores/useTransactionHistoryStore";
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
  displayName?: string;
};

export type StartPasskeyOptions = {
  /**
   * Sign-up: the private name of the new account. iOS lists the passkey under
   * it, so several accounts on one phone can be told apart in its picker.
   */
  label?: string;
  /** Sign-in: offer this one credential only, instead of every passkey for ATARA. */
  credentialId?: string;
};

type AuthContextValue = {
  isReady: boolean;
  isPrivyReady: boolean;
  isFullyAuthenticated: boolean;
  isAuthTransitioning: boolean;
  onboardingStep: OnboardingStep;
  isCheckingBackend: boolean;
  isStartingOAuth: boolean;
  oauthError: string | null;
  isExternalWalletEnabled: boolean;
  startPasskey: (mode: "login" | "signup", options?: StartPasskeyOptions) => Promise<void>;
  startExternalWallet: () => Promise<void>;
  startOAuth: (provider: OAuthProvider) => Promise<void>;
  registerWithHandle: (params: RegisterWithHandleParams) => Promise<void>;
  checkHandle: (handle: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ONBOARDING_TRANSITION_MS = 600;

/** The chosen name cannot be used. A sentence for the person, not a sign-in fault. */
class AccountNameRefused extends Error {}

const signPersonalMessage = async (
  wallet: EthereumSignerWallet,
  message: string,
): Promise<string> => {
  const provider = await withTimeout(wallet.getProvider());
  const signature = await withTimeout(provider.request({
    method: "personal_sign",
    params: [stringToHex(message), wallet.address],
  }), 60_000, "The wallet signature was not confirmed. Try again.");

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
  const privyClient = usePrivyClient();
  const passkeyDeps = useMemo(() => createPasskeyDeps(privyClient), [privyClient]);
  const externalWallet = useExternalWallet();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
  const walletAddress = useAuthStore((state) => state.user?.smartAccountAddress);

  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("gate");
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const [activeAuthMethod, setActiveAuthMethod] = useState<AuthMethod>("privy");
  const ignoredAutoLoginUserIdRef = useRef<string | null>(null);
  const entryBusyRef = useRef(false);
  const entryRevisionRef = useRef(0);
  const providerCleanupRef = useRef<Promise<void> | null>(null);
  const autoLoginKeyRef = useRef<string | null>(null);
  const autoLoginAbortRef = useRef<AbortController | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const embeddedWallets = wallets as EthereumSignerWallet[];
  const walletsRef = useRef(embeddedWallets);
  walletsRef.current = embeddedWallets;
  const registrationRef = useRef<AbortController | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  useEffect(() => () => registrationRef.current?.abort(), []);
  // A valid backend session is enough to read ATARA data. Requiring a live
  // Privy session here would make wallet-only users depend on a social-login
  // provider even after proving ownership with their wallet.
  const isReady = hasLoadedSession && !isAuthLoading;
  const isFullyAuthenticated = isAuthenticated;

  useEffect(() => {
    if (externalWallet.isConnected && !user && !entryBusyRef.current) {
      setActiveAuthMethod("external_wallet");
    }
  }, [externalWallet.isConnected, user]);

  useEffect(() => { if (isFullyAuthenticated) void retryPendingSettlements().catch(() => {}); }, [isFullyAuthenticated]);

  // A payment confirmed while the service could not be reached is recorded when
  // this account signs in again. Only the recording is retried, never the payment.
  useEffect(() => {
    if (!isFullyAuthenticated || !walletAddress) return;
    void flushRecordings(walletAddress)
      .then((summary) => {
        if (summary.recorded > 0) void useTransactionHistoryStore.getState().fetchHistory();
      })
      .catch(() => {});
  }, [isFullyAuthenticated, walletAddress]);

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

  const clearProviderSessions = useCallback(async () => {
    if (!providerCleanupRef.current) {
      const cleanup = Promise.allSettled([
        Promise.resolve().then(() => privyLogout()),
        Promise.resolve().then(() => externalWallet.disconnect()),
      ]).then((results) => {
        if (results.some((result) => result.status === "rejected")) {
          throw new Error("The provider session could not be closed. Try again before switching accounts.");
        }
      });
      providerCleanupRef.current = cleanup;
      void cleanup.finally(() => {
        if (providerCleanupRef.current === cleanup) providerCleanupRef.current = null;
      }).catch(() => undefined);
    }
    await withTimeout(providerCleanupRef.current, 12_000,
      "Provider logout is still pending. Try again before switching accounts.");
  }, [externalWallet.disconnect, privyLogout]);

  const logout = useCallback(async () => {
    entryRevisionRef.current += 1;
    registrationRef.current?.abort();
    registrationRef.current = null;
    autoLoginAbortRef.current?.abort();
    autoLoginAbortRef.current = null;
    setIsRegistering(false);
    ignoredAutoLoginUserIdRef.current = user?.id ?? null;
    autoLoginKeyRef.current = null;
    setIsCheckingBackend(false);
    setOnboardingStep("gate");
    // Revoke the local ATARA session first. A slow or unavailable provider must
    // never leave private screens visible after an explicit logout.
    await useAuthStore.getState().logout();
    setIsStartingOAuth(true);
    try {
      await clearProviderSessions();
      setOauthError(null);
    } catch (error) {
      setOauthError(error instanceof Error ? error.message : "Logout incomplete. Try again.");
    } finally {
      setIsStartingOAuth(false);
    }
    setOnboardingStep("gate");
    autoLoginKeyRef.current = null;
  }, [clearProviderSessions, user?.id]);

  const prepareSignIn = useCallback(async (method: AuthMethod) => {
    const revision = entryRevisionRef.current;
    // A gate action means a fresh login, never silently linking a new identity
    // to the stale Privy user still left behind by a revoked ATARA session.
    autoLoginAbortRef.current?.abort();
    autoLoginKeyRef.current = null;
    ignoredAutoLoginUserIdRef.current = user?.id ?? null;
    await clearProviderSessions();
    if (entryRevisionRef.current !== revision) throw new Error("Sign-in canceled.");
    setActiveAuthMethod(method);
    await useAuthStore.getState().clearJustLoggedOut();
    if (entryRevisionRef.current !== revision) {
      await useAuthStore.getState().logout();
      throw new Error("Sign-in canceled.");
    }
    ignoredAutoLoginUserIdRef.current = null;
  }, [clearProviderSessions, user?.id]);

  const startOAuth = useCallback(
    async (provider: OAuthProvider) => {
      if (entryBusyRef.current) return;
      if (!isPrivyReady) {
        setOauthError("The sign-in service is still starting. Try again in a moment.");
        return;
      }
      entryBusyRef.current = true;
      setIsStartingOAuth(true);
      setOauthError(null);
      try {
        await prepareSignIn("privy");
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
        entryBusyRef.current = false;
        setIsStartingOAuth(false);
      }
    },
    [isPrivyReady, loginWithOAuth, prepareSignIn],
  );

  /**
   * What this phone learns from a passkey sign-in, before the ATARA profile is
   * loaded. The entry is found by the Privy user id, never by a name.
   */
  const rememberPasskeySignIn = useCallback(
    async (privyUser: UserLike & { id: string }, credentialId: string | null) => {
      try {
        const registry = useAccountRegistryStore.getState();
        const passkeys = listPasskeys(privyUser);
        // The picker does not say which credential was chosen. When the account
        // has exactly one passkey, that is the one that just worked.
        const used = credentialId ?? (passkeys.length === 1 ? passkeys[0].credentialId : null);
        await registry.recordSignIn({
          key: newAccountKey(randomBytes(12)),
          bytes: randomBytes(4),
          privyUserId: privyUser.id,
          userId: null,
          passkeys,
          usedCredentialId: used,
          now: Date.now(),
        });

        // A switch aimed at one account, answered by a passkey Privy files under
        // another: the list was wrong about that credential. Stop offering it.
        const intent = useAccountSwitchStore.getState().intent;
        const landed = useAccountRegistryStore.getState().find({ privyUserId: privyUser.id });
        if (credentialId && intent?.kind === "switch" && landed && landed.key !== intent.target.accountKey) {
          await registry.removePasskey(intent.target.accountKey, credentialId);
        }
      } catch {
        // The list of accounts is a convenience. Failing to save it must never
        // fail a sign-in that succeeded.
      }
    },
    [],
  );

  const startPasskey = useCallback(async (mode: "login" | "signup", options: StartPasskeyOptions = {}) => {
    if (entryBusyRef.current) return;
    const relyingParty = process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
    if (!relyingParty) { setOauthError("Passkey sign-in requires domain configuration."); return; }
    if (!isPrivyReady) { setOauthError("The passkey service is still starting. Try again in a moment."); return; }
    entryBusyRef.current = true;
    setIsStartingOAuth(true); setOauthError(null);
    try {
      await prepareSignIn("privy");
      const input = { relyingParty: `https://${relyingParty}` };
      if (mode === "signup") {
        // The name iOS shows for this passkey. Chosen here, before the passkey
        // exists: it cannot be changed afterwards from inside an app.
        await registryReady();
        const registry = useAccountRegistryStore.getState();
        const taken = [...labelsInUse(registry), ...passkeyNamesInUse(registry)];
        const chosen = options.label ? checkAccountLabel(options.label, taken) : null;
        if (chosen && !chosen.ok) throw new AccountNameRefused(LABEL_ERROR_TEXT[chosen.reason]);
        const label = chosen?.ok ? chosen.label : suggestAccountLabel({ taken, bytes: randomBytes(4) });

        const created = await createNamedPasskey(passkeyDeps, {
          mode: "signup",
          relyingParty: input.relyingParty,
          label,
        });
        try {
          await registry.beginPending({
            key: newAccountKey(randomBytes(12)),
            privyUserId: created.user.id,
            label: created.label,
            credentialId: created.credentialId,
            now: Date.now(),
          });
        } catch {
          // Same as above: the sign-up itself succeeded.
        }
      } else if (options.credentialId) {
        const signed = await signInWithPasskey(passkeyDeps, {
          relyingParty: input.relyingParty,
          credentialId: options.credentialId,
          embedded: embeddedWalletConfig,
        });
        await rememberPasskeySignIn(signed.user, signed.credentialId);
      } else {
        const privyUser = await loginWithPasskey(input);
        if (privyUser) await rememberPasskeySignIn(privyUser as UserLike & { id: string }, null);
      }
    }
    catch (error) {
      if (error instanceof AccountNameRefused) {
        setOauthError(error.message);
        return;
      }
      // A bare provider string ("Signup with passkey not allowed") says nothing
      // about which system refused or what to change, and a store build has no
      // console to dig further.
      const cause = error instanceof PasskeyFlowError ? error.original : error;
      // iOS words a cancellation in several ways; the service knows them all.
      const failure = error instanceof PasskeyFlowError && error.cancelled
        ? { layer: "unknown" as const, message: "Sign-in canceled.", raw: error.message }
        : describeAuthFailure(cause, { method: "passkey" });
      // Privy's wording rarely says whether the missing domain association is
      // the real reason. Ask the association file directly rather than send
      // someone into the Privy dashboard for a server-side problem.
      const association = failure.layer === "api"
        ? await probeDomainAssociation(relyingParty) : undefined;
      const text = formatAuthFailure(association ?? failure);
      const orphan = error instanceof PasskeyFlowError ? error.orphanedPasskeyName : undefined;
      setOauthError(orphan
        ? `${text} A passkey named “${orphan}” was created on this iPhone but linked to no account. It does nothing: you can delete it in Settings > Passwords.`
        : text);
    }
    finally { entryBusyRef.current = false; setIsStartingOAuth(false); }
  }, [isPrivyReady, loginWithPasskey, passkeyDeps, prepareSignIn, rememberPasskeySignIn]);

  const startExternalWallet = useCallback(async () => {
    if (entryBusyRef.current) return;
    entryBusyRef.current = true;
    setIsStartingOAuth(true);
    setOauthError(null);
    try {
      await prepareSignIn("external_wallet");
      await externalWallet.connect();
    } catch (error) {
      setOauthError(
        formatAuthFailure(describeAuthFailure(error, { method: "wallet" })),
      );
    } finally {
      entryBusyRef.current = false;
      setIsStartingOAuth(false);
    }
  }, [externalWallet, prepareSignIn]);

  const registerWithHandle = useCallback(
    async ({ handle, displayName }: RegisterWithHandleParams) => {
      if (registrationRef.current) return;
      const controller = new AbortController();
      registrationRef.current = controller;
      setIsRegistering(true);
      const { signal } = controller;
      try {
        const useConnectedWallet =
          activeAuthMethod === "external_wallet";
        if (useConnectedWallet && !externalWallet.wallet) {
          throw new Error("Your wallet disconnected. Go back and reconnect it.");
        }
        let signerWallet: EthereumSignerWallet | undefined = useConnectedWallet
          ? externalWallet.wallet
          : findWalletByAddress(walletsRef.current, getPrimaryEmbeddedEthereumWalletAddress(user));
        let signerAddress = useConnectedWallet
          ? externalWallet.address
          : signerWallet?.address || getPrimaryEmbeddedEthereumWalletAddress(user);

        if (!signerAddress && !useConnectedWallet) {
          const result = await create({ createAdditional: false });
          assertActive(signal);
          signerAddress =
            getPrimaryEmbeddedEthereumWalletAddress(result.user) ||
            getPrimaryEmbeddedEthereumWalletAddress(user);
        }

        if (!signerAddress) {
          throw new Error("Wallet not ready. Please wait...");
        }

        if (!useConnectedWallet) {
          signerWallet = await waitForWallet(() => walletsRef.current, signerAddress, signal);
        }
        if (!signerWallet) throw new Error("Your wallet disconnected. Go back and reconnect it.");
        assertActive(signal);

        if (useConnectedWallet) {
          await externalWallet.ensureSupportedNetwork();
        }
        assertActive(signal);

        const smartAccountService = await createAlchemySmartAccountService({
          wallet: signerWallet,
        });
        assertActive(signal);
        const smartAccountAddress = smartAccountService.getSmartAccountAddress();

        if (!smartAccountAddress) {
          throw new Error("Smart account not ready. Please try again.");
        }

        const challenge = await AuthService.requestChallenge(
          signerAddress,
          "register",
          signal,
        );
        assertActive(signal);
        const registrationSignature = await signPersonalMessage(
          signerWallet,
          challenge.message,
        );
        assertActive(signal);

        if (!registrationSignature) {
          throw new Error("Failed to verify wallet ownership. Please try again.");
        }

        await AuthService.register({
          handle,
          displayName,
          smartAccountAddress,
          signerAddress,
          email: getPrimaryEmailAddress(user) || undefined,
          authProvider: useConnectedWallet
            ? "external_wallet"
            : getPrimaryOAuthProvider(user) ?? "passkey",
          message: challenge.message,
          signature: registrationSignature,
        }, signal);

        assertActive(signal);
        playAuthenticatedTransition(Haptics.ImpactFeedbackStyle.Medium);
      } finally {
        if (registrationRef.current === controller) {
          registrationRef.current = null;
          setIsRegistering(false);
        }
      }
    },
    [
      activeAuthMethod,
      create,
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
      isPrivyReady,
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
      isPrivyReady,
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
        isStartingSignIn={isStartingOAuth}
        activeAuthMethod={activeAuthMethod}
        isRegistering={isRegistering}
        embeddedWallets={embeddedWallets}
        externalWallet={externalWallet.wallet}
        externalWalletConnected={externalWallet.isConnected}
        ensureExternalWalletNetwork={externalWallet.ensureSupportedNetwork}
        hasLoadedSession={hasLoadedSession}
        ignoredAutoLoginUserIdRef={ignoredAutoLoginUserIdRef}
        autoLoginKeyRef={autoLoginKeyRef}
        autoLoginAbortRef={autoLoginAbortRef}
        onSessionLoaded={handleSessionLoaded}
        onCheckingBackendChange={setIsCheckingBackend}
        onOnboardingStepChange={setOnboardingStep}
        onAuthenticated={handleAuthenticated}
        logout={logout}
      />
      <AccountRegistrySync />
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Keeps this phone's list of accounts (stores/useAccountRegistryStore.ts) in line
 * with whoever is signed in. It only writes to that local list: nothing it does
 * reaches the API.
 *
 * Runs once ATARA has authenticated, because that is when the @handle, the
 * address and the ATARA user id are known. The entry is found by the Privy user
 * id and the ATARA user id; a name plays no part in it.
 */
const AccountRegistrySync = () => {
  const { user: privyUser, isReady: isPrivyReady } = usePrivy();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const profile = useAuthStore((state) => state.user);
  const isExternalWallet = profile?.authProvider === "external_wallet";
  const privyUserId = privyUser?.id ?? null;
  const passkeys = useMemo(() => listPasskeys(privyUser), [privyUser]);
  const passkeyIds = passkeys.map((passkey) => passkey.credentialId).sort().join(",");

  useEffect(() => {
    if (!isAuthenticated || !profile?.id) return;
    // Wait for Privy so the entry is bound to its user id from the start.
    if (!isPrivyReady && !isExternalWallet) return;

    let cancelled = false;
    (async () => {
      const registry = useAccountRegistryStore.getState();
      await registry.recordSignIn({
        key: newAccountKey(randomBytes(12)),
        bytes: randomBytes(4),
        privyUserId,
        userId: profile.id,
        handle: profile.handle || null,
        smartAccountAddress: profile.smartAccountAddress || null,
        authProvider: profile.authProvider ?? null,
        // With no Privy user, the list of passkeys is unknown, not empty.
        passkeys: privyUser ? passkeys : undefined,
        now: Date.now(),
      });
      if (cancelled) return;

      // The sign-in is complete. If it was a switch, say so when it did not reach
      // the account the person asked for. That is decided by the Privy user id.
      const { intent, clear } = useAccountSwitchStore.getState();
      const landing = checkLanding(useAccountRegistryStore.getState(), intent, {
        privyUserId,
        userId: profile.id,
      });
      if (!landing.matched) {
        useAlertStore.getState().show(
          {
            type: "warning",
            title: "Signed in to a different account",
            message: `You are signed in to “${landing.landed.label}”${
              landing.expected ? `, not “${landing.expected.label}”` : ""
            }.${
              intent?.kind === "switch" && intent.target.plan.method === "passkey" && landing.expected
                ? ` ATARA no longer offers that passkey for “${landing.expected.label}”.`
                : ""
            }`,
          },
          9000,
        );
      }
      if (intent) clear();
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // `passkeys` and `privyUser` are represented by the ids below: a new object
    // with the same content must not write again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    isExternalWallet,
    isPrivyReady,
    passkeyIds,
    privyUserId,
    profile?.authProvider,
    profile?.handle,
    profile?.id,
    profile?.smartAccountAddress,
  ]);

  return null;
};

type AuthenticationManagerProps = {
  isStartingSignIn: boolean;
  activeAuthMethod: AuthMethod;
  isRegistering: boolean;
  embeddedWallets: EthereumSignerWallet[];
  externalWallet?: EthereumSignerWallet;
  externalWalletConnected: boolean;
  ensureExternalWalletNetwork: () => Promise<void>;
  hasLoadedSession: boolean;
  ignoredAutoLoginUserIdRef: MutableRefObject<string | null>;
  autoLoginKeyRef: MutableRefObject<string | null>;
  autoLoginAbortRef: MutableRefObject<AbortController | null>;
  onSessionLoaded: () => void;
  onCheckingBackendChange: (isChecking: boolean) => void;
  onOnboardingStepChange: (step: OnboardingStep) => void;
  onAuthenticated: () => void;
  logout: () => Promise<void>;
};

const AuthenticationManager = ({
  isStartingSignIn,
  activeAuthMethod,
  isRegistering,
  embeddedWallets,
  externalWallet,
  externalWalletConnected,
  ensureExternalWalletNetwork,
  hasLoadedSession,
  ignoredAutoLoginUserIdRef,
  autoLoginKeyRef,
  autoLoginAbortRef,
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
    registerUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    let mounted = true;

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
  }, [onSessionLoaded]);

  useEffect(() => {
    if (
      isStartingSignIn || activeAuthMethod !== "privy" || isRegistering || !isPrivyReady ||
      !hasLoadedSession ||
      !user ||
      externalWalletConnected
    ) return;

    if (justLoggedOut) {
      ignoredAutoLoginUserIdRef.current = user.id;
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
    autoLoginAbortRef.current?.abort();
    const controller = new AbortController();
    autoLoginAbortRef.current = controller;
    onCheckingBackendChange(true);

    AuthService.loginWithSigner(signerAddress, (message) =>
      signPersonalMessage(signerWallet, message),
      controller.signal,
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
        if (autoLoginAbortRef.current === controller) {
          autoLoginAbortRef.current = null;
        }
        if (autoLoginKeyRef.current === autoLoginKey) {
          autoLoginKeyRef.current = null;
          onCheckingBackendChange(false);
          return;
        }
        // The key changed while this attempt was in flight. When it changed to
        // another attempt, that one owns the spinner and will lower it. When it
        // was cleared - a logout, for instance - nobody else will, and leaving
        // it raised locks the gate screen with every button greyed out behind
        // "Verifying ownership...".
        if (autoLoginKeyRef.current === null) {
          onCheckingBackendChange(false);
        }
      });

    return () => {
      controller.abort();
      if (autoLoginAbortRef.current === controller) {
        autoLoginAbortRef.current = null;
      }
      if (autoLoginKeyRef.current === autoLoginKey) {
        autoLoginKeyRef.current = null;
        onCheckingBackendChange(false);
      }
    };
  }, [
    isStartingSignIn,
    activeAuthMethod,
    embeddedWallets,
    isRegistering,
    externalWalletConnected,
    hasLoadedSession,
    ignoredAutoLoginUserIdRef,
    isAuthenticated,
    isPrivyReady,
    justLoggedOut,
    autoLoginKeyRef,
    autoLoginAbortRef,
    onAuthenticated,
    onCheckingBackendChange,
    onOnboardingStepChange,
    showAuthError,
    user,
  ]);

  useEffect(() => {
    if (
      isStartingSignIn || activeAuthMethod !== "external_wallet" || isRegistering || !hasLoadedSession ||
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
    autoLoginAbortRef.current?.abort();
    const controller = new AbortController();
    autoLoginAbortRef.current = controller;
    onCheckingBackendChange(true);

    ensureExternalWalletNetwork()
      .then(() => {
        assertActive(controller.signal);
        return AuthService.loginWithSigner(
          externalWallet.address,
          (message) => signPersonalMessage(externalWallet, message),
          controller.signal,
        );
      })
      .then(() => {
        if (autoLoginKeyRef.current === autoLoginKey) onAuthenticated();
      })
      .catch((error: any) => {
        if (autoLoginKeyRef.current !== autoLoginKey) return;
        if (error?.response?.status === 404) {
          onOnboardingStepChange("identity");
        } else {
          showAuthError(
            "Wallet connection incomplete",
            error?.message || "Check the Base network and try again.",
          );
        }
      })
      .finally(() => {
        if (autoLoginAbortRef.current === controller) {
          autoLoginAbortRef.current = null;
        }
        if (autoLoginKeyRef.current === autoLoginKey) {
          autoLoginKeyRef.current = null;
          onCheckingBackendChange(false);
          return;
        }
        // Same reasoning as the embedded-wallet attempt above: when the key was
        // cleared rather than replaced, no other attempt will lower the spinner.
        if (autoLoginKeyRef.current === null) {
          onCheckingBackendChange(false);
        }
      });

    return () => {
      controller.abort();
      if (autoLoginAbortRef.current === controller) {
        autoLoginAbortRef.current = null;
      }
      if (autoLoginKeyRef.current === autoLoginKey) {
        autoLoginKeyRef.current = null;
        onCheckingBackendChange(false);
      }
    };
  }, [
    isStartingSignIn,
    activeAuthMethod,
    autoLoginAbortRef,
    autoLoginKeyRef,
    isRegistering,
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
