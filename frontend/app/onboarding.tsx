import { useState } from "react";
import { View } from "react-native";
import { GateScreen } from "../components/onboarding/GateScreen";
import { IdentityScreen } from "../components/onboarding/IdentityScreen";
import { useAuth } from "@/providers/AuthProvider";

export default function Onboarding() {
  const [handle, setHandle] = useState("");
  const {
    onboardingStep,
    isPrivyReady,
    isCheckingBackend,
    isStartingOAuth,
    oauthError,
    isExternalWalletEnabled,
    startOAuth,
    startPasskey,
    startExternalWallet,
    registerWithHandle,
    checkHandle,
    logout,
  } = useAuth();

  return (
    <View className="flex-1 bg-void">
      {onboardingStep === "gate" && (
        <GateScreen
          isCheckingBackend={isCheckingBackend}
          isPrivyReady={isPrivyReady}
          isStartingOAuth={isStartingOAuth}
          oauthError={oauthError}
          isExternalWalletEnabled={isExternalWalletEnabled}
          onStartOAuth={startOAuth}
          onStartPasskey={startPasskey}
          onStartExternalWallet={startExternalWallet}
          onResetSession={logout}
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
