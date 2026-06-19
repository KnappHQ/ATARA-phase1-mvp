import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Check, ChevronRight, AlertCircle } from "lucide-react-native";
import { CrownIcon } from "./CrownIcon";
import { COLORS, NOTION_LEGAL_URL } from "@/utils/constants";
import { useState, useEffect, useCallback } from "react";
import { useEmbeddedEthereumWallet, usePrivy } from "@privy-io/expo";
import { AuthService } from "@/services/auth.service";
import { createAlchemySmartAccountService } from "@/services/smartAccount.service";
import debounce from "@/utils/debounce";
import * as Linking from "expo-linking";
import {
  getPrimaryEmbeddedEthereumWalletAddress,
  getPrimaryEmailAddress,
  getPrimaryOAuthProvider,
} from "@/utils/privy";

interface IdentityScreenProps {
  handle: string;
  setHandle: (h: string) => void;
  onFinish: () => void;
}

export const IdentityScreen = ({
  handle,
  setHandle,
  onFinish,
}: IdentityScreenProps) => {
  const isValid = handle.length >= 3;
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);

  const { user } = usePrivy();
  const { wallets, create } = useEmbeddedEthereumWallet();

  // Debounced handle availability check
  const checkHandleAvailability = useCallback(
    debounce(async (h: string) => {
      if (h.length < 3) {
        setIsAvailable(null);
        return;
      }
      setIsChecking(true);
      try {
        const available = await AuthService.checkHandle(h);
        setIsAvailable(available);
      } catch {
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 500),
    [],
  );

  useEffect(() => {
    setIsAvailable(null);
    setError(null);
    if (handle.length >= 3) {
      checkHandleAvailability(handle);
    }
  }, [handle]);

  const openLegalLink = async () => {
    try {
      await Linking.openURL(NOTION_LEGAL_URL);
    } catch {
      setError("Unable to open legal terms right now.");
    }
  };

  const handleFinish = async () => {
    if (!isValid || !isAvailable || !acceptedLegalTerms) return;

    setIsRegistering(true);
    setError(null);

    try {
      let signerWallet: (typeof wallets)[number] | undefined = wallets[0];
      let signerAddress =
        signerWallet?.address || getPrimaryEmbeddedEthereumWalletAddress(user);

      if (!signerAddress) {
        const result = await create({ createAdditional: false });
        signerAddress =
          getPrimaryEmbeddedEthereumWalletAddress(result.user) ||
          getPrimaryEmbeddedEthereumWalletAddress(user);
        signerWallet = wallets.find(
          (wallet) =>
            wallet.address.toLowerCase() === signerAddress?.toLowerCase(),
        );
      }

      const email = getPrimaryEmailAddress(user);
      const authProvider = getPrimaryOAuthProvider(user) ?? "privy";

      if (!signerAddress) {
        setError("Wallet not ready. Please wait...");
        setIsRegistering(false);
        return;
      }

      if (!signerWallet) {
        setError("Wallet provider not ready. Please try again in a moment.");
        setIsRegistering(false);
        return;
      }

      const smartAccountService = await createAlchemySmartAccountService({
        wallet: signerWallet,
      });
      const smartAccountAddress = smartAccountService.getSmartAccountAddress();

      if (!smartAccountAddress) {
        setError("Smart account not ready. Please try again.");
        setIsRegistering(false);
        return;
      }

      await AuthService.register({
        handle,
        smartAccountAddress,
        signerAddress,
        email: email || undefined,
        authProvider,
      });

      onFinish();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        "Registration failed. Please try again.";
      setError(message);
    } finally {
      setIsRegistering(false);
    }
  };

  const canSubmit =
    isValid && isAvailable === true && acceptedLegalTerms && !isRegistering;

  return (
    <SafeAreaView className="flex-1 items-center justify-center px-8">
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 400, delay: 100 }}
        className="items-center mb-16"
      >
        <CrownIcon size={48} color={COLORS.white} />
        <Text className="mt-4 text-[30px] font-bold tracking-[12px] text-white">
          ATARA
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 300, delay: 200 }}
        className="w-full max-w-[320px]"
      >
        <View className="bg-transparent border border-white/30">
          <View className="flex-row items-center px-4">
            <Text className="text-white/50 text-lg">@</Text>
            <TextInput
              value={handle}
              onChangeText={(text) =>
                setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
              placeholder="handle"
              placeholderTextColor={COLORS.placeholder}
              className="flex-1 py-4 px-2 text-lg text-white"
              maxLength={20}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isChecking && (
              <ActivityIndicator size="small" color={COLORS.white} />
            )}
            {!isChecking && isAvailable === true && isValid && (
              <Check size={20} color={COLORS.checkmark} />
            )}
            {!isChecking && isAvailable === false && isValid && (
              <AlertCircle size={20} color="#EF4444" />
            )}
          </View>
        </View>

        {isAvailable === false && isValid && (
          <Text className="text-red-400 text-xs mt-2 px-1">
            This handle is already taken
          </Text>
        )}

        {error && (
          <Text className="text-red-400 text-xs mt-2 px-1">{error}</Text>
        )}

        <View className="mt-5 flex-row items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <Pressable
            onPress={() => setAcceptedLegalTerms((value) => !value)}
            className={`mt-0.5 h-5 w-5 items-center justify-center rounded-[6px] border ${
              acceptedLegalTerms
                ? "border-white bg-white"
                : "border-white/30 bg-transparent"
            }`}
          >
            {acceptedLegalTerms && (
              <Check size={13} color={COLORS.black} strokeWidth={3} />
            )}
          </Pressable>

          <Text className="flex-1 text-[12px] leading-5 text-white/75">
            I agree to the{` `}
            <Text
              onPress={openLegalLink}
              className="font-semibold text-white underline underline-offset-2"
            >
              Terms of Service
            </Text>
            {` `}and{` `}
            <Text
              onPress={openLegalLink}
              className="font-semibold text-white underline underline-offset-2"
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>

        {!acceptedLegalTerms && (
          <Text className="mt-2 px-1 text-[11px] text-white/35">
            Please accept the terms to continue.
          </Text>
        )}
      </MotiView>

      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 300, delay: 400 }}
      >
        <TouchableOpacity
          onPress={handleFinish}
          disabled={!canSubmit}
          activeOpacity={0.9}
          className={`mt-8 px-14 py-4 flex-row items-center gap-2 ${
            canSubmit ? "bg-white" : "bg-transparent border border-white/20"
          }`}
        >
          {isRegistering ? (
            <ActivityIndicator
              size="small"
              color={canSubmit ? COLORS.black : COLORS.white}
            />
          ) : (
            <>
              <Text
                className={`text-base font-medium ${
                  canSubmit ? "text-black" : "text-white"
                }`}
              >
                Get Started
              </Text>
              <ChevronRight
                size={20}
                color={canSubmit ? COLORS.black : COLORS.white}
              />
            </>
          )}
        </TouchableOpacity>
      </MotiView>
    </SafeAreaView>
  );
};
