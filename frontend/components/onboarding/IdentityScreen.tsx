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
import {
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react-native";
import { CrownIcon } from "./CrownIcon";
import { COLORS } from "@/utils/constants";
import { useState, useEffect, useMemo } from "react";
import debounce from "@/utils/debounce";
import { TermsOfServiceScreen } from "@/components/profile/TermsOfServiceScreen";
import { PrivacyPolicyScreen } from "@/components/profile/PrivacyPolicyScreen";

interface IdentityScreenProps {
  handle: string;
  setHandle: (h: string) => void;
  onCheckHandle: (handle: string) => Promise<boolean>;
  onSubmit: (params: { handle: string }) => Promise<void>;
  onBack: () => Promise<void>;
}

const formatRegistrationError = (error: any): string => {
  const raw = String(error?.response?.data?.message || error?.message || "");

  if (
    /alchemy|wallet_requestAccount|must be authenticated|EXPO_PUBLIC_ALCHEMY/i.test(
      raw,
    )
  ) {
    return "Account setup is temporarily unavailable. Please go back and try another sign-in method.";
  }

  return raw || "Registration failed. Please try again.";
};

export const IdentityScreen = ({
  handle,
  setHandle,
  onCheckHandle,
  onSubmit,
  onBack,
}: IdentityScreenProps) => {
  const isValid = handle.length >= 3;
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);

  // Debounced handle availability check
  const checkHandleAvailability = useMemo(
    () =>
      debounce(async (h: string) => {
        if (h.length < 3) {
          setIsAvailable(null);
          return;
        }
        setIsChecking(true);
        try {
          const available = await onCheckHandle(h);
          setIsAvailable(available);
        } catch {
          setIsAvailable(null);
        } finally {
          setIsChecking(false);
        }
      }, 500),
    [onCheckHandle],
  );

  useEffect(() => {
    setIsAvailable(null);
    setError(null);
    if (handle.length >= 3) {
      checkHandleAvailability(handle);
    }
  }, [checkHandleAvailability, handle]);

  const handleFinish = async () => {
    if (!isValid || !isAvailable || !acceptedLegalTerms) return;

    setIsRegistering(true);
    setError(null);

    try {
      await onSubmit({ handle });
    } catch (err: any) {
      setError(formatRegistrationError(err));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBack = async () => {
    if (isGoingBack || isRegistering) return;
    setIsGoingBack(true);
    setError(null);
    try {
      await onBack();
    } finally {
      setIsGoingBack(false);
    }
  };

  const canSubmit =
    isValid && isAvailable === true && acceptedLegalTerms && !isRegistering;

  return (
    <SafeAreaView className="flex-1 items-center justify-center px-8">
      <TouchableOpacity
        onPress={handleBack}
        disabled={isGoingBack || isRegistering}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Back to sign-in methods"
        className="absolute left-5 top-4 z-10 flex-row items-center gap-1 rounded-full border border-white/15 bg-black/60 px-3 py-2"
      >
        {isGoingBack ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <ChevronLeft size={20} color={COLORS.white} />
        )}
        <Text className="text-sm font-medium text-white">Back</Text>
      </TouchableOpacity>

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
              onPress={() => setTermsOpen(true)}
              className="font-semibold text-white underline underline-offset-2"
            >
              Terms of Service
            </Text>
            {` `}and{` `}
            <Text
              onPress={() => setPrivacyOpen(true)}
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

      <TermsOfServiceScreen
        isOpen={termsOpen}
        onBack={() => setTermsOpen(false)}
      />
      <PrivacyPolicyScreen
        isOpen={privacyOpen}
        onBack={() => setPrivacyOpen(false)}
      />

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
