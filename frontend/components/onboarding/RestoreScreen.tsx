import { Eye, EyeOff } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface RestoreScreenProps {
  onRestore: (mnemonic: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export const RestoreScreen = ({
  onRestore,
  onBack,
  isLoading = false,
}: RestoreScreenProps) => {
  const SEED_WORD_COUNT = 12;
  const [words, setWords] = useState<string[]>(Array(SEED_WORD_COUNT).fill(""));
  const [showWords, setShowWords] = useState(false);

  const filledCount = words.filter((w) => w.trim()).length;
  const isValid = filledCount === SEED_WORD_COUNT;

  const distributeSeedPhrase = useCallback((input: string) => {
    const splitWords = input
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, SEED_WORD_COUNT);

    setWords((prevWords) => {
      const newWords = [...prevWords];
      splitWords.forEach((w, i) => {
        if (i < SEED_WORD_COUNT) newWords[i] = w;
      });
      return newWords;
    });
  }, []);

  const handleRecover = () => {
    if (!isValid) return;
    const mnemonic = words.join(" ").trim();
    onRestore(mnemonic);
  };

  return (
    <SafeAreaView className="flex-1 items-center justify-center px-6">
      <View className="flex-row items-center gap-4 mb-8">
        <Text className="text-sm font-orbitron text-champagne/70 tracking-[0.25em] uppercase">
          Restore Vault
        </Text>
        <Pressable onPress={() => setShowWords(!showWords)}>
          {showWords ? (
            <EyeOff size={18} color="rgba(229, 210, 166, 0.7)" />
          ) : (
            <Eye size={18} color="rgba(229, 210, 166, 0.7)" />
          )}
        </Pressable>
      </View>

      <View className="w-full max-w-sm rounded-2xl p-5 border border-champagne/15 bg-obsidian-glass/50">
        <View className="flex-row flex-wrap gap-2">
          {words.map((word, index) => (
            <View key={index} className="flex-row items-center gap-2 w-[48%]">
              <Text className="text-[10px] text-foreground/30 font-rajdhani w-4 text-right">
                {index + 1}.
              </Text>
              <TextInput
                value={word}
                onChangeText={(text) => {
                  if (text.includes(" ")) {
                    distributeSeedPhrase(text);
                  } else {
                    setWords((prevWords) => {
                      const newWords = [...prevWords];
                      newWords[index] = text.trim().toLowerCase();
                      return newWords;
                    });
                  }
                }}
                placeholder="────"
                placeholderTextColor="rgba(234, 223, 202, 0.15)"
                secureTextEntry={!showWords}
                className="flex-1 h-10 px-3 py-1 bg-background/30 rounded-lg border border-foreground/10 text-base font-rajdhani text-foreground/80"
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="text"
                importantForAutofill="no"
                textContentType="none"
                autoComplete="off"
              />
            </View>
          ))}
        </View>

        <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-foreground/5">
          <Text
            className={`text-[10px] font-rajdhani ${
              filledCount === 12 ? "text-champagne/60" : "text-foreground/30"
            }`}
          >
            {filledCount}/12 words
          </Text>
        </View>
      </View>

      <Text className="text-[10px] text-muted-foreground/60 text-center mt-4 max-w-xs font-rajdhani">
        Never share your seed phrase with anyone. We will never ask for it.
      </Text>

      <View className="flex-row gap-3 mt-8">
        <Pressable
          onPress={onBack}
          disabled={isLoading}
          className="px-8 py-4 rounded-xl border border-champagne/20 active:scale-95"
        >
          <Text className="text-foreground/70 text-base tracking-wide font-rajdhani">
            Back
          </Text>
        </Pressable>

        <Pressable
          onPress={handleRecover}
          disabled={!isValid || isLoading}
          className={`px-10 py-4 rounded-xl border ${
            isValid
              ? "border-champagne/40 bg-champagne/10"
              : "border-champagne/20 bg-obsidian-glass/30"
          } ${isLoading ? "opacity-80" : "active:scale-95"}`}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFE666" size="small" />
          ) : (
            <Text
              className={`text-base tracking-[0.15em] font-rajdhani uppercase ${
                isValid ? "text-champagne" : "text-champagne/40"
              }`}
            >
              Recover
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
