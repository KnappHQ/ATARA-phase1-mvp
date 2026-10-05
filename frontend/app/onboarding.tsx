import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { usePrivy } from "@privy-io/expo";
import { GateScreen } from "../components/onboarding/GateScreen";
import { IdentityScreen } from "../components/onboarding/IdentityScreen";
import { useAuth } from "@/providers/AuthProvider";
import { randomBytes } from "@/services/passkeyRuntime";
import { useAccountRegistryStore } from "@/stores/useAccountRegistryStore";
import { useAccountSwitchStore } from "@/stores/useAccountSwitchStore";
import { useOnboardingDraftStore } from "@/stores/useOnboardingDraftStore";
import { sanitizeHandle } from "@/utils/handleRules";
import { suggestAccountLabel } from "@/utils/accountLabels";
import { REGISTRY_VERSION, labelsInUse, passkeyNamesInUse } from "@/utils/accountRegistry";

const DRAFT_SAVE_DELAY_MS = 300;

/** True once the saved drafts have been read from the phone. */
const useDraftsLoaded = () => {
  const [loaded, setLoaded] = useState(() => useOnboardingDraftStore.persist.hasHydrated());
  useEffect(() => {
    if (useOnboardingDraftStore.persist.hasHydrated()) {
      setLoaded(true);
      return;
    }
    return useOnboardingDraftStore.persist.onFinishHydration(() => setLoaded(true));
  }, []);
  return loaded;
};

export default function Onboarding() {
  const [handle, setHandle] = useState("");
  const [accountName, setAccountName] = useState("");
  const {
    onboardingStep,
    isPrivyReady,
    isCheckingBackend,
    isStartingOAuth,
    oauthError,
    startOAuth,
    startPasskey,
    registerWithHandle,
    checkHandle,
    logout,
  } = useAuth();
  const { user } = usePrivy();
  const userId = user?.id ?? null;
  const draftsLoaded = useDraftsLoaded();
  const restoredFor = useRef<string | null>(null);
  const finished = useRef(false);
  const accounts = useAccountRegistryStore((state) => state.accounts);
  const intent = useAccountSwitchStore((state) => state.intent);
  const clearIntent = useAccountSwitchStore((state) => state.clear);

  // Names in use on this iPhone, for accounts and for the passkeys iOS lists.
  const takenNames = useMemo(() => {
    const registry = { version: REGISTRY_VERSION, accounts };
    return [...labelsInUse(registry), ...passkeyNamesInUse(registry)];
  }, [accounts]);
  const suggestedName = useMemo(
    () => suggestAccountLabel({ taken: takenNames, bytes: randomBytes(4) }),
    [takenNames],
  );

  // Bring back what was typed before the app was closed (never the terms box).
  useEffect(() => {
    if (onboardingStep !== "identity" || !draftsLoaded || !userId) return;
    if (restoredFor.current === userId) return;
    restoredFor.current = userId;
    const draft = useOnboardingDraftStore.getState().read(userId);
    if (!draft) return;
    const { handle: savedHandle, accountName: savedName } = draft;
    setHandle((current) => current || sanitizeHandle(savedHandle));
    setAccountName((current) => current || savedName);
  }, [onboardingStep, draftsLoaded, userId]);

  // Keep the draft up to date while the person types.
  useEffect(() => {
    if (onboardingStep !== "identity" || !draftsLoaded || !userId) return;
    if (restoredFor.current !== userId || finished.current) return;
    const timer = setTimeout(() => {
      useOnboardingDraftStore.getState().save(userId, { handle, accountName });
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onboardingStep, draftsLoaded, userId, handle, accountName]);

  const submit = useCallback(
    async (params: { handle: string; displayName?: string }) => {
      await registerWithHandle(params);
      // Registered: the draft is not needed any more.
      finished.current = true;
      if (userId) useOnboardingDraftStore.getState().clear(userId);
    },
    [registerWithHandle, userId],
  );

  return (
    <View className="flex-1 bg-void">
      {onboardingStep === "gate" && (
        <GateScreen
          isCheckingBackend={isCheckingBackend}
          isPrivyReady={isPrivyReady}
          isStartingOAuth={isStartingOAuth}
          oauthError={oauthError}
          onStartOAuth={startOAuth}
          onStartPasskey={startPasskey}
          onResetSession={logout}
          takenNames={takenNames}
          suggestedName={suggestedName}
          intent={intent}
          onDismissIntent={clearIntent}
        />
      )}

      {onboardingStep === "identity" && (
        <IdentityScreen
          handle={handle}
          setHandle={setHandle}
          accountName={accountName}
          setAccountName={setAccountName}
          onCheckHandle={checkHandle}
          onSubmit={submit}
          onBack={logout}
        />
      )}
    </View>
  );
}
