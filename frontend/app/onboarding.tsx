import { useState, useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { GateScreen } from "../components/onboarding/GateScreen";
import { IdentityScreen } from "../components/onboarding/IdentityScreen";
import { VaultOpeningAnimation } from "../components/onboarding/VaultOpeningAnimation";
import { useSignerStatus, useUser } from "@account-kit/react-native";
import { AlchemySignerStatus } from "@account-kit/signer";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAlertStore } from "@/stores/useAlertStore";
import { AuthService } from "@/services/auth.service";

type OnboardingStep = "gate" | "identity";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("gate");
  const [handle, setHandle] = useState("");
  const [isVaultOpening, setIsVaultOpening] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);

  const { status: signerStatus, isAuthenticating } = useSignerStatus();
  const signerConnected = signerStatus === AlchemySignerStatus.CONNECTED;
  const user = useUser();
  const { isAuthenticated } = useAuthStore();

  const goToTabs = () => {
    setIsVaultOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => router.replace("/(tabs)"), 600);
  };

  useEffect(() => {
    if (!signerConnected || !user) return;

    // Already have a valid session (e.g. re-auth after JWT expiry)
    if (isAuthenticated) {
      goToTabs();
      return;
    }

    if (step !== "gate") return;

    const checkExistingUser = async () => {
      setIsCheckingBackend(true);
      try {
        await AuthService.loginWithSigner(user.address);
        goToTabs();
      } catch (err: any) {
        if (err?.response?.status === 404) {
          // New user — let them pick a handle
          setStep("identity");
        } else {
          // Network or server error — stay on gate, show alert
          useAlertStore
            .getState()
            .error(
              "Sign in failed",
              "Please check your connection and try again.",
            );
        }
      } finally {
        setIsCheckingBackend(false);
      }
    };

    checkExistingUser();
  }, [signerConnected, user]);

  const handleFinish = () => {
    setIsVaultOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => router.replace("/(tabs)"), 600);
  };

  return (
    <View className="flex-1 bg-void">
      {isVaultOpening && <VaultOpeningAnimation />}

      {step === "gate" && !isVaultOpening && (
        <GateScreen isCheckingBackend={isCheckingBackend || isAuthenticating} />
      )}

      {step === "identity" && !isVaultOpening && (
        <IdentityScreen
          handle={handle}
          setHandle={setHandle}
          onFinish={handleFinish}
        />
      )}
    </View>
  );
}
