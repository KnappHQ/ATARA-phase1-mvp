import { useMemo, useState } from "react";
import { View } from "react-native";
import { GateScreen } from "../components/onboarding/GateScreen";
import { IdentityScreen } from "../components/onboarding/IdentityScreen";
import { useAuth } from "@/providers/AuthProvider";
import { randomBytes } from "@/services/passkeyRuntime";
import { useAccountRegistryStore } from "@/stores/useAccountRegistryStore";
import { useAccountSwitchStore } from "@/stores/useAccountSwitchStore";
import { suggestAccountLabel } from "@/utils/accountLabels";
import { REGISTRY_VERSION, labelsInUse, passkeyNamesInUse } from "@/utils/accountRegistry";

export default function Onboarding() {
  const [handle, setHandle] = useState("");
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
          onCheckHandle={checkHandle}
          onSubmit={registerWithHandle}
          onBack={logout}
        />
      )}
    </View>
  );
}
