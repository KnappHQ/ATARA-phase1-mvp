import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Check, ChevronRight } from "lucide-react-native";
import { CrownIcon } from "./CrownIcon";
import { COLORS } from "@/utils/constants";

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
            {isValid && (
              <MotiView
                from={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <Check size={20} color={COLORS.checkmark} />
              </MotiView>
            )}
          </View>
        </View>
      </MotiView>

      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 300, delay: 400 }}
      >
        <TouchableOpacity
          onPress={onFinish}
          disabled={!isValid}
          activeOpacity={0.9}
          className={`mt-8 px-14 py-4 flex-row items-center gap-2 ${
            isValid ? "bg-white" : "bg-transparent border border-white/20"
          }`}
        >
          <Text
            className={`text-base font-medium ${
              isValid ? "text-black" : "text-white"
            }`}
          >
            Get Started
          </Text>
          <ChevronRight
            size={20}
            color={isValid ? COLORS.black : COLORS.white}
          />
        </TouchableOpacity>
      </MotiView>
    </SafeAreaView>
  );
};
