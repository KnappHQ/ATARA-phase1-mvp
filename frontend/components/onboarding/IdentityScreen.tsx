import { Check } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface IdentityScreenProps {
  handle: string;
  setHandle: (h: string) => void;
  onNext: () => void;
}

export const IdentityScreen = ({
  handle,
  setHandle,
  onNext,
}: IdentityScreenProps) => {
  const isValid = handle.length >= 3;

  return (
    <SafeAreaView className="flex-1 items-center justify-center px-8">
      <Text className="text-6xl font-rajdhani text-champagne tracking-[0.3em] mb-20">
        ASTRÂ
      </Text>

      <View className="w-full max-w-xs">
        <View className="rounded-xl border border-champagne/20 bg-obsidian-glass/50 overflow-hidden">
          <View className="flex-row items-center px-5">
            <Text className="text-champagne/50 text-xl">@</Text>
            <TextInput
              value={handle}
              onChangeText={(text) =>
                setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
              placeholder="handle"
              placeholderTextColor="rgba(234, 223, 202, 0.25)"
              className="flex-1 py-5 px-2 text-xl text-foreground tracking-wide font-rajdhani"
              maxLength={20}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isValid && <Check size={22} color="rgba(229, 210, 166, 0.7)" />}
          </View>
        </View>
      </View>

      <Pressable
        onPress={onNext}
        disabled={!isValid}
        className={`mt-10 px-16 py-4 rounded-xl border active:scale-95 ${
          isValid
            ? "border-champagne/40 bg-champagne/5"
            : "border-champagne/20 bg-obsidian-glass/30"
        }`}
      >
        <Text
          className={`font-rajdhani text-base tracking-[0.15em] uppercase ${
            isValid ? "text-champagne" : "text-champagne/40"
          }`}
        >
          Continue
        </Text>
      </Pressable>
    </SafeAreaView>
  );
};
