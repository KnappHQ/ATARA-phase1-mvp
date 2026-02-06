import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Fingerprint } from "lucide-react-native";
import { CrownIcon } from "./CrownIcon";
import { COLORS } from "@/utils/constants";

interface WelcomeBackScreenProps {
  handle: string;
  onUnlock: () => void;
  onNewAccount: () => void;
}

export const WelcomeBackScreen = ({
  handle,
  onUnlock,
  onNewAccount,
}: WelcomeBackScreenProps) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleUnlock = () => {
    setIsScanning(true);
    setTimeout(() => {
      onUnlock();
    }, 500);
  };

  return (
    <SafeAreaView className="flex-1 items-center justify-center px-8">
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 400, delay: 100 }}
        className="items-center mb-12"
      >
        <CrownIcon size={48} color={COLORS.white} />
        <Text className="mt-4 text-[30px] font-bold tracking-[12px] text-white">
          ATARA
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 300, delay: 200 }}
        className="mb-10"
      >
        <Text className="text-2xl text-white font-light">@{handle}</Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 300, delay: 300 }}
      >
        <TouchableOpacity
          onPress={handleUnlock}
          disabled={isScanning}
          activeOpacity={0.8}
          className="w-20 h-20 rounded-full bg-transparent border border-white/30 items-center justify-center mb-8"
        >
          <MotiView
            animate={
              isScanning
                ? {
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7],
                  }
                : {}
            }
            transition={{
              type: "timing",
              duration: 500,
              loop: isScanning,
            }}
          >
            <Fingerprint size={40} color={COLORS.white} />
          </MotiView>
        </TouchableOpacity>
      </MotiView>

      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 300, delay: 500 }}
      >
        <TouchableOpacity onPress={onNewAccount} className="py-2">
          <Text className="text-xs text-white/30">New Account</Text>
        </TouchableOpacity>
      </MotiView>
    </SafeAreaView>
  );
};
