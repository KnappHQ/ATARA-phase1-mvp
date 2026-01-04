import { AuthService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/useAuthStore";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { GateScreen } from "../components/onboarding/GateScreen";
import { IdentityScreen } from "../components/onboarding/IdentityScreen";
import { RestoreScreen } from "../components/onboarding/RestoreScreen";
import { SecurityScreen } from "../components/onboarding/SecurityScreen";
import { VaultOpeningAnimation } from "../components/onboarding/VaultOpeningAnimation";

type OnboardingStep = "gate" | "identity" | "security" | "restore";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("gate");
  const [handle, setHandle] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);

  const [isVaultOpening, setIsVaultOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [walletAddress, setWalletAddress] = useState<string>("");
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);

  useEffect(() => {
    checkExistingUser();
    initializeWallet();
  }, []);

  const checkExistingUser = async () => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (isAuthenticated) {
      router.replace("/");
    }
  };

  const initializeWallet = async () => {
    try {
      const { mnemonic, address } = await AuthService.createWallet();
      if (mnemonic) {
        setSeedPhrase(mnemonic.split(" "));
        setWalletAddress(address);
      }
    } catch (e) {
      console.error("Failed to init wallet", e);
    }
  };

  const handleCopyKey = async () => {
    await Clipboard.setStringAsync(seedPhrase.join(" "));
    setKeyCopied(true);
  };

  const handleFinish = async () => {
    if (!handle.trim()) {
      Alert.alert("Error", "Handle is required");
      return;
    }

    setIsLoading(true);

    try {
      await AuthService.register(handle, walletAddress);
      setIsLoading(false);
      setIsVaultOpening(true);
    } catch (error: any) {
      console.error("Registration Error:", error);
      setIsLoading(false);
      Alert.alert(
        "Registration Failed",
        error?.response?.data?.message || "Could not create account"
      );
    }
  };

  const handleRestore = async (mnemonic: string) => {
    if (!mnemonic.trim()) return;

    setIsLoading(true);

    try {
      await AuthService.restoreWallet(mnemonic);
      await AuthService.login();

      setIsLoading(false);
      setIsVaultOpening(true);
    } catch (error: any) {
      console.error("Restore Error:", error);
      setIsLoading(false);
      Alert.alert("Login Failed", "Invalid seed phrase or account not found.");
    }
  };

  const onAnimationComplete = () => {
    router.replace("/");
  };

  return (
    <View className="flex-1 bg-background">
      {isVaultOpening && (
        <VaultOpeningAnimation onComplete={onAnimationComplete} />
      )}

      {step === "gate" && !isVaultOpening && (
        <GateScreen
          onInitialize={() => setStep("identity")}
          onRestore={() => setStep("restore")}
        />
      )}

      {step === "identity" && !isVaultOpening && (
        <IdentityScreen
          handle={handle}
          setHandle={setHandle}
          onNext={() => setStep("security")}
        />
      )}

      {step === "security" && !isVaultOpening && (
        <SecurityScreen
          seedPhrase={seedPhrase}
          keyCopied={keyCopied}
          onCopyKey={handleCopyKey}
          onFinish={handleFinish}
          isLoading={isLoading}
        />
      )}

      {step === "restore" && !isVaultOpening && (
        <RestoreScreen
          onRestore={handleRestore}
          onBack={() => setStep("gate")}
          isLoading={isLoading}
        />
      )}
    </View>
  );
}
