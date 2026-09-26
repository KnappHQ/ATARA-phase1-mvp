import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
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
import { useState, useEffect, useRef } from "react";
import { TermsOfServiceScreen } from "@/components/profile/TermsOfServiceScreen";
import { PrivacyPolicyScreen } from "@/components/profile/PrivacyPolicyScreen";

interface IdentityScreenProps {
  handle: string;
  setHandle: (h: string) => void;
  onCheckHandle: (handle: string) => Promise<boolean>;
  onSubmit: (params: { handle: string; displayName?: string }) => Promise<void>;
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
  const [accountName, setAccountName] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setIsAvailable(null);
    setError(null);
    setIsChecking(handle.length >= 3);
    const timer = setTimeout(async () => {
      if (handle.length < 3) return;
      try {
        const available = await onCheckHandle(handle);
        if (!cancelled) setIsAvailable(available);
      } catch {
        if (!cancelled) setError("Unable to check this handle. Check your connection and edit it to retry.");
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [onCheckHandle, handle]);

  const handleFinish = async () => {
    if (busyRef.current || isGoingBack || isChecking || !isValid || !isAvailable || !acceptedLegalTerms) return;
    busyRef.current = true;
    Keyboard.dismiss();

    setIsRegistering(true);
    setError(null);

    try {
      await onSubmit({ handle, displayName: accountName.trim() || undefined });
    } catch (err: any) {
      setError(formatRegistrationError(err));
    } finally {
      busyRef.current = false;
      setIsRegistering(false);
    }
  };

  const handleBack = async () => {
    if (isGoingBack) return;
    Keyboard.dismiss();
    setIsGoingBack(true);
    setError(null);
    try {
      await onBack();
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setIsGoingBack(false);
    }
  };

  const canSubmit =
    isValid && isAvailable === true && acceptedLegalTerms && !isRegistering && !isGoingBack && !isChecking;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
      <TouchableOpacity
        onPress={handleBack}
        disabled={isGoingBack}
        hitSlop={8}
        style={{ minHeight: 48, alignSelf: "flex-start" }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Back to sign-in methods"
        className="flex-row items-center gap-1 rounded-full border border-white/15 bg-black/60 px-4 py-2"
      >
        {isGoingBack ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <ChevronLeft size={20} color={COLORS.white} />
        )}
        <Text className="text-sm font-medium text-white">Back</Text>
      </TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24 }}>

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
              editable={!isRegistering && !isGoingBack}
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

        <Text className="text-white/60 text-xs mt-5 mb-2">
          Account name (optional, visible in your profile)
        </Text>
        <TextInput
          value={accountName}
          onChangeText={setAccountName}
          placeholder="For example: Personal account"
          placeholderTextColor={COLORS.placeholder}
          maxLength={40}
          editable={!isRegistering && !isGoingBack}
          className="border border-white/30 px-4 py-4 text-white text-base"
        />
        <Text className="text-white/40 text-[11px] leading-4 mt-2">
          You can change it later. iOS may display only “ATARA”
          in its passkey list.
        </Text>

        <View className="mt-5 flex-row items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <Pressable
            hitSlop={12}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedLegalTerms }}
            accessibilityLabel="Accept terms and privacy policy"
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
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
