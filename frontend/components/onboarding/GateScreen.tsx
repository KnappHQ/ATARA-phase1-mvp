import { Text, TouchableOpacity, Image, ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { CrownIcon } from "./CrownIcon";
import { COLORS } from "@/utils/constants";
import { Fingerprint, WalletCards } from "lucide-react-native";

interface GateScreenProps {
  isCheckingBackend?: boolean;
  isStartingOAuth?: boolean;
  oauthError?: string | null;
  isExternalWalletEnabled?: boolean;
  onStartPasskey: (mode: "login" | "signup") => void;
  onStartExternalWallet: () => void;
  onStartOAuth: (provider: "google" | "apple") => void;
}

export const GateScreen = ({
  isCheckingBackend = false,
  isStartingOAuth = false,
  oauthError = null,
  isExternalWalletEnabled = false,
  onStartOAuth,
  onStartPasskey,
  onStartExternalWallet,
}: GateScreenProps) => {
  const showLoading = isStartingOAuth || isCheckingBackend;
  const passkeyEnabled = !!process.env.EXPO_PUBLIC_PASSKEY_RP_ID;

  return (
    <SafeAreaView className="flex-1 items-center justify-center px-8">
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 100 }}
        className="items-center mb-10"
      >
        <CrownIcon size={56} color={COLORS.white} />
        <Text className="mt-8 text-[30px] font-bold tracking-[12px] text-white">
          ATARA
        </Text>
        <Text className="mt-3 text-[11px] font-medium tracking-[4px] uppercase text-[#E0E0E0]">
          Universal Sovereignty
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 300, delay: 300 }}
        className="w-full max-w-[320px] gap-3"
      >
        <Text className="text-white text-xl font-semibold text-center mb-1">
          Your wallet. Your choice.
        </Text>
        <Text className="text-white/55 text-sm text-center leading-5 mb-3">
          No social account is required. The ATARA API cannot sign on your behalf.
        </Text>

        <TouchableOpacity
          onPress={() => onStartPasskey("signup")}
          activeOpacity={0.8}
          disabled={showLoading || !passkeyEnabled}
          className={`w-full py-4 px-6 flex-row items-center justify-center gap-3 ${
            showLoading || !passkeyEnabled ? "opacity-45" : ""
          }`}
          style={{ backgroundColor: COLORS.white }}
        >
          <Fingerprint size={20} color={COLORS.black} />
          <Text className="text-base text-black font-semibold tracking-normal">
            Create with a passkey
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onStartExternalWallet}
          activeOpacity={0.8}
          disabled={showLoading || !isExternalWalletEnabled}
          className={`w-full py-4 px-6 bg-transparent border border-white/30 flex-row items-center justify-center gap-3 ${
            showLoading || !isExternalWalletEnabled ? "opacity-45" : ""
          }`}
        >
          <WalletCards size={20} color={COLORS.white} />
          <Text className="text-base text-white tracking-normal">
            Connect an existing wallet
          </Text>
        </TouchableOpacity>

        {!passkeyEnabled && (
          <Text className="text-amber-300/80 text-[11px] text-center">
            Passkeys await the secure-domain configuration.
          </Text>
        )}
        {!isExternalWalletEnabled && (
          <Text className="text-white/35 text-[11px] text-center">
            External wallets await the Reown project identifier.
          </Text>
        )}

        {passkeyEnabled && (
          <TouchableOpacity
            onPress={() => onStartPasskey("login")}
            disabled={showLoading}
            className="py-2"
          >
            <Text className="text-white/70 text-sm text-center underline">
              I already have an ATARA passkey
            </Text>
          </TouchableOpacity>
        )}

        <View className="flex-row items-center gap-3 my-1">
          <View className="flex-1 h-px bg-white/10" />
          <Text className="text-white/35 text-[10px] uppercase tracking-[2px]">
            optional social access
          </Text>
          <View className="flex-1 h-px bg-white/10" />
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => onStartOAuth("google")}
            activeOpacity={0.8}
            disabled={showLoading}
            className={`flex-1 py-3 px-3 border border-white/15 flex-row items-center justify-center gap-2 ${showLoading ? "opacity-50" : ""}`}
          >
            <Image source={require("@/assets/images/google-logo.png")} className="w-4 h-4" resizeMode="contain" />
            <Text className="text-sm text-white">Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onStartOAuth("apple")}
            activeOpacity={0.8}
            disabled={showLoading}
            className={`flex-1 py-3 px-3 border border-white/15 flex-row items-center justify-center gap-2 ${showLoading ? "opacity-50" : ""}`}
          >
            <Image source={require("@/assets/images/apple-logo.png")} className="w-4 h-4" resizeMode="contain" />
            <Text className="text-sm text-white">Apple</Text>
          </TouchableOpacity>
        </View>
        {showLoading && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="items-center mt-4"
          >
            <ActivityIndicator size="small" color={COLORS.white} />
            <Text className="text-white/60 text-xs mt-2">
              {isCheckingBackend ? "Verifying account..." : "Authenticating..."}
            </Text>
          </MotiView>
        )}

        {oauthError && (
          <Text className="text-red-400 text-xs text-center mt-2">
            {oauthError}
          </Text>
        )}
      </MotiView>
    </SafeAreaView>
  );
};
