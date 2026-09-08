import { useState } from "react";
import { View } from "react-native";
import { GateScreen } from "../components/onboarding/GateScreen";
import { IdentityScreen } from "../components/onboarding/IdentityScreen";
import { useAuth } from "@/providers/AuthProvider";

export default function Onboarding() {
  const [handle, setHandle] = useState("");
  const {
    onboardingStep,
    isCheckingBackend,
    isStartingOAuth,
    oauthError,
    startOAuth,
    startPasskey,
    registerWithHandle,
    checkHandle,
  } = useAuth();

  return (
    <View className="flex-1 bg-void">
      {onboardingStep === "gate" && (
        <GateScreen
          isCheckingBackend={isCheckingBackend}
          isStartingOAuth={isStartingOAuth}
          oauthError={oauthError}
          onStartOAuth={startOAuth}
          onStartPasskey={startPasskey}
        />
      )}

      {onboardingStep === "identity" && (
        <IdentityScreen
          handle={handle}
          setHandle={setHandle}
          onCheckHandle={checkHandle}
          onSubmit={registerWithHandle}
        />
      )}
    </View>
  );
}
