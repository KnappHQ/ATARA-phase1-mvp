import { UserService } from "@/services/user.service";
import { Check, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
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
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAvailable(null);

    const cleanHandle = handle.trim().toLowerCase();

    if (cleanHandle.length < 3) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);

    const timeoutId = setTimeout(async () => {
      const available = await UserService.checkHandle(cleanHandle);
      setIsAvailable(available);
      setIsChecking(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [handle]);

  const isValid = handle.length >= 3 && !isChecking && isAvailable === true;

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
            <View className="ml-2">
              {isChecking ? (
                <ActivityIndicator size="small" color="#E5D2A6" />
              ) : isAvailable === true ? (
                <Check size={22} color="rgba(229, 210, 166, 0.7)" />
              ) : isAvailable === false ? (
                <X size={22} color="rgba(229, 210, 166, 0.7)" />
              ) : null}
            </View>
          </View>
        </View>

        {isAvailable === false && !isChecking && (
          <Text className="text-champagne/50 text-xs font-rajdhani mt-4 ml-2">
            Handle is already taken
          </Text>
        )}
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
