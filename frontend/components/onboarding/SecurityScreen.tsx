import { Copy, Shield } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SecurityScreenProps {
  seedPhrase: string[];
  keyCopied: boolean;
  onCopyKey: () => void;
  onFinish: () => void;
  isLoading?: boolean;
}

export const SecurityScreen = ({
  seedPhrase,
  keyCopied,
  onCopyKey,
  onFinish,
  isLoading = false,
}: SecurityScreenProps) => {
  return (
    <SafeAreaView className="flex-1 items-center justify-center px-6">
      <View className="flex-row items-center gap-2 mb-8">
        <Shield size={18} color="rgba(229, 210, 166, 0.7)" />
        <Text className="text-sm font-orbitron text-champagne/70 tracking-[0.25em] uppercase">
          Your Security Key
        </Text>
      </View>

      <View className="w-full max-w-sm rounded-2xl p-5 border border-champagne/15 bg-obsidian-glass/50">
        <View className="flex-row flex-wrap gap-2 justify-center">
          {seedPhrase.map((word, i) => (
            <View
              key={i}
              className="bg-background/40 rounded-lg py-2 px-2 flex-1 min-w-[30%] max-w-[31%] items-center"
            >
              <Text className="text-foreground/30 text-xs font-rajdhani">
                {i + 1}
              </Text>
              <Text className="text-foreground/80 text-base font-rajdhani">
                {word}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text className="text-[10px] text-muted-foreground/60 text-center mt-4 max-w-xs font-rajdhani">
        Write this down and store it safely. This is the only way to recover
        your wallet.
      </Text>

      <View className="flex-row gap-3 mt-8">
        <Pressable
          onPress={onCopyKey}
          className="px-8 py-4 rounded-xl border border-champagne/20 flex-row items-center gap-2 active:scale-95"
        >
          <Copy size={18} color="rgba(234, 223, 202, 0.7)" />
          <Text className="text-foreground/70 text-base tracking-wide font-rajdhani">
            {keyCopied ? "Copied" : "Copy"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onFinish}
          disabled={isLoading}
          className={`px-10 py-4 rounded-xl border border-champagne/40 bg-champagne/10 items-center justify-center ${
            isLoading ? "opacity-80" : "active:scale-95"
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFE666" size="small" />
          ) : (
            <Text className="text-champagne text-base tracking-[0.1em] font-rajdhani uppercase">
              Finish
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
