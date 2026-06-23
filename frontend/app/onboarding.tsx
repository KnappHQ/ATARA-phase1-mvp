import { useState, useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { GateScreen } from "../components/onboarding/GateScreen";
import { IdentityScreen } from "../components/onboarding/IdentityScreen";
import { VaultOpeningAnimation } from "../components/onboarding/VaultOpeningAnimation";
import { usePrivy, useEmbeddedEthereumWallet } from "@privy-io/expo";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAlertStore } from "@/stores/useAlertStore";
import { AuthService } from "@/services/auth.service";
import { getPrimaryEmbeddedEthereumWalletAddress } from "@/utils/privy";

type OnboardingStep = "gate" | "identity";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("gate");
  const [handle, setHandle] = useState("");
  const [isVaultOpening, setIsVaultOpening] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);

  const { user, isReady } = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();
  const { isAuthenticated, justLoggedOut } = useAuthStore();

  const goToTabs = () => {
    setIsVaultOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => router.replace("/(tabs)"), 600);
  };

  useEffect(() => {
    if (!isReady || !user) return;

    // If user just logged out, don't auto-login — wait for manual action
    if (justLoggedOut) {
      // Clear the persisted flag after checking so future loads work normally
      useAuthStore.getState().clearJustLoggedOut();
      return;
    }

    // Already have a valid session (e.g. re-auth after JWT expiry)
    if (isAuthenticated) {
      goToTabs();
      return;
    }

    if (step !== "gate") return;

    const signerAddress = getPrimaryEmbeddedEthereumWalletAddress(user);

    if (!signerAddress) {
      setStep("identity");
      return;
    }

    const checkExistingUser = async () => {
      setIsCheckingBackend(true);
      try {
        // Find the wallet that matches the signer address
        const wallet = wallets?.find(
          (w) => w.address.toLowerCase() === signerAddress.toLowerCase(),
        );

        // If we don't have a wallet to sign with, treat as new user
        if (!wallet) {
          setStep("identity");
          return;
        }

        // Create sign function for wallet message signing using Privy's provider
        const signFunction = async (message: string) => {
          try {
            const provider = await wallet.getProvider();
            const signature = await provider.request({
              method: "personal_sign",
              params: [message, wallet.address],
            });
            return signature;
          } catch (err) {
            console.error("Failed to sign login message:", err);
            return "";
          }
        };

        await AuthService.loginWithSigner(signerAddress, signFunction);
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
  }, [isReady, user, isAuthenticated, step, wallets]);

  const handleFinish = () => {
    setIsVaultOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => router.replace("/(tabs)"), 600);
  };

  return (
    <View className="flex-1 bg-void">
      {isVaultOpening && <VaultOpeningAnimation />}

      {step === "gate" && !isVaultOpening && (
        <GateScreen isCheckingBackend={isCheckingBackend} />
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
