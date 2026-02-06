import { Text, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { CrownIcon } from "./CrownIcon";
import { COLORS } from "@/utils/constants";

interface GateScreenProps {
  onSocialAuth: (provider: "google" | "apple") => void;
}

export const GateScreen = ({ onSocialAuth }: GateScreenProps) => {
  return (
    <SafeAreaView className="flex-1 items-center justify-center px-8">
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 100 }}
        className="items-center mb-20"
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
        <TouchableOpacity
          onPress={() => onSocialAuth("google")}
          activeOpacity={0.8}
          className="w-full py-4 px-6 bg-transparent border border-white/30 flex-row items-center justify-center gap-3"
        >
          <Image
            source={require("@/assets/images/google-logo.png")}
            className="w-5 h-5"
            resizeMode="contain"
          />
          <Text className="text-base text-white tracking-normal">
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSocialAuth("apple")}
          activeOpacity={0.8}
          className="w-full py-4 px-6 bg-transparent border border-white/30 flex-row items-center justify-center gap-3"
        >
          <Image
            source={require("@/assets/images/apple-logo.png")}
            className="w-5 h-5"
            resizeMode="contain"
          />
          <Text className="text-base text-white tracking-normal">
            Continue with Apple
          </Text>
        </TouchableOpacity>
      </MotiView>
    </SafeAreaView>
  );
};
