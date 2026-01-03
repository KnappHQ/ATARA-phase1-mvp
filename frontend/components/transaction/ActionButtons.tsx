import { ArrowLeft, Share2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface ActionButtonsProps {
  onShareProof: () => void;
  onBackToDashboard: () => void;
}

export const ActionButtons = ({
  onShareProof,
  onBackToDashboard,
}: ActionButtonsProps) => {
  return (
    <Animated.View entering={FadeInDown.delay(1500)} className="mt-8 gap-4">
      <Pressable
        onPress={onShareProof}
        className="w-full py-4 rounded-xl items-center justify-center border border-champagne/40 active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <Share2 size={20} color="#FFE666" />
          <Text className="font-rajdhani-semibold text-champagne">
            Share Proof
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onBackToDashboard}
        className="w-full py-3 items-center justify-center"
      >
        <View className="flex-row items-center gap-2">
          <ArrowLeft size={16} color="rgba(255, 255, 255, 0.6)" />
          <Text className="text-sm text-muted-foreground">
            Back to Dashboard
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};
