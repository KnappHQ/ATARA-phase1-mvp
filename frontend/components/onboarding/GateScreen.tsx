import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Fingerprint, ShieldCheck, WalletCards } from "lucide-react-native";

import { CrownIcon } from "./CrownIcon";
import { COLORS } from "@/utils/constants";

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
    <SafeAreaView className="flex-1 items-center justify-center px-7">
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 100 }}
        className="items-center mb-8"
      >
        <CrownIcon size={52} color={COLORS.white} />
        <Text className="mt-7 text-[29px] font-bold tracking-[11px] text-white">
          ATARA
        </Text>
        <Text className="mt-3 text-[10px] font-medium tracking-[3.5px] uppercase text-[#E0E0E0]">
          Universal Sovereignty
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 300, delay: 250 }}
        className="w-full max-w-[340px]"
      >
        <View className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <ShieldCheck size={16} color={COLORS.accent} />
            <Text className="text-[10px] uppercase tracking-[2px] text-white/55">
              Sovereign access
            </Text>
          </View>

          <Text className="text-white text-xl font-semibold mb-2">
            Your keys. Your route.
          </Text>
          <Text className="text-white/55 text-sm leading-5 mb-5">
            Passkey and wallet access do not require a Google or Apple account.
            Social sign-in stays optional.
          </Text>

          <TouchableOpacity
            onPress={() => onStartPasskey("signup")}
            activeOpacity={0.8}
            disabled={showLoading || !passkeyEnabled}
            className={`w-full py-4 px-5 flex-row items-center justify-center gap-3 rounded-2xl ${
              showLoading || !passkeyEnabled ? "opacity-45" : ""
            }`}
            style={{ backgroundColor: COLORS.white }}
          >
            <Fingerprint size={20} color={COLORS.black} />
            <View>
              <Text className="text-base text-black font-semibold">
                Create with a passkey
              </Text>
              <Text className="text-[11px] text-black/55 text-center mt-0.5">
                No social account required
              </Text>
            </View>
          </TouchableOpacity>

          {passkeyEnabled && (
            <TouchableOpacity
              onPress={() => onStartPasskey("login")}
              activeOpacity={0.8}
              disabled={showLoading}
              className={`w-full py-3.5 px-5 mt-3 border border-white/20 rounded-2xl flex-row items-center justify-center gap-3 ${
                showLoading ? "opacity-50" : ""
              }`}
            >
              <Fingerprint size={18} color={COLORS.white} />
              <Text className="text-sm text-white font-medium">
                Sign in with an existing passkey
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={onStartExternalWallet}
            activeOpacity={0.8}
            disabled={showLoading || !isExternalWalletEnabled}
            className={`w-full py-4 px-5 mt-3 border border-white/25 rounded-2xl flex-row items-center justify-center gap-3 ${
              showLoading || !isExternalWalletEnabled ? "opacity-45" : ""
            }`}
          >
            <WalletCards size={19} color={COLORS.white} />
            <View>
              <Text className="text-sm text-white font-semibold text-center">
                Use my existing wallet
              </Text>
              <Text className="text-[11px] text-white/45 text-center mt-0.5">
                Prove ownership with a one-time signature
              </Text>
            </View>
          </TouchableOpacity>

          {!passkeyEnabled && (
            <Text className="text-amber-300/80 text-[11px] text-center mt-3">
              Passkeys are waiting for the secure-domain configuration.
            </Text>
          )}
          {!isExternalWalletEnabled && (
            <Text className="text-white/35 text-[11px] text-center mt-3">
              Wallet-only access is ready in the app but still needs the Reown
              project identifier to be activated.
            </Text>
          )}
        </View>

        <View className="flex-row items-center gap-3 my-2">
          <View className="flex-1 h-px bg-white/10" />
          <Text className="text-white/35 text-[9px] uppercase tracking-[2px]">
            Optional convenience
          </Text>
          <View className="flex-1 h-px bg-white/10" />
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => onStartOAuth("google")}
            activeOpacity={0.8}
            disabled={showLoading}
            className={`flex-1 py-3.5 px-3 border border-white/15 rounded-2xl flex-row items-center justify-center gap-2 ${
              showLoading ? "opacity-50" : ""
            }`}
          >
            <Text className="text-sm text-white">Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onStartOAuth("apple")}
            activeOpacity={0.8}
            disabled={showLoading}
            className={`flex-1 py-3.5 px-3 border border-white/15 rounded-2xl flex-row items-center justify-center gap-2 ${
              showLoading ? "opacity-50" : ""
            }`}
          >
            <Text className="text-sm text-white">Apple</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-white/35 text-[11px] leading-4 text-center mt-4 px-2">
          ATARA never asks for your seed phrase. Wallet-only login signs a
          temporary challenge; the ATARA API cannot sign a transfer for you.
        </Text>

        {showLoading && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="items-center mt-4"
          >
            <ActivityIndicator size="small" color={COLORS.white} />
            <Text className="text-white/60 text-xs mt-2">
              {isCheckingBackend
                ? "Verifying ownership..."
                : "Authenticating..."}
            </Text>
          </MotiView>
        )}

        {oauthError && (
          <Text className="text-red-400 text-xs text-center mt-3">
            {oauthError}
          </Text>
        )}
      </MotiView>
    </SafeAreaView>
  );
};
