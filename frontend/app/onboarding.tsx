import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { GateScreen } from "../components/onboarding/GateScreen";
import { IdentityScreen } from "../components/onboarding/IdentityScreen";
import { WelcomeBackScreen } from "../components/onboarding/WelcomeBackScreen";
import { VaultOpeningAnimation } from "../components/onboarding/VaultOpeningAnimation";

type OnboardingStep = "gate" | "identity" | "welcome-back";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("gate");
  const [handle, setHandle] = useState("");
  const [isVaultOpening, setIsVaultOpening] = useState(false);
  const [existingUser] = useState<string | null>(null); // Dummy: set to null for new user flow

  const handleFinish = () => {
    setIsVaultOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      router.replace("/");
    }, 600);
  };

  const handleSocialAuth = (provider: "google" | "apple") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep("identity");
  };

  const handleBioUnlock = () => {
    setIsVaultOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => {
      router.replace("/");
    }, 500);
  };

  return (
    <View className="flex-1 bg-void">
      {isVaultOpening && <VaultOpeningAnimation />}

      {step === "gate" && !isVaultOpening && (
        <GateScreen onSocialAuth={handleSocialAuth} />
      )}

      {step === "identity" && !isVaultOpening && (
        <IdentityScreen
          handle={handle}
          setHandle={setHandle}
          onFinish={handleFinish}
        />
      )}

      {step === "welcome-back" && !isVaultOpening && existingUser && (
        <WelcomeBackScreen
          handle={existingUser}
          onUnlock={handleBioUnlock}
          onNewAccount={() => setStep("gate")}
        />
      )}
    </View>
  );
}
