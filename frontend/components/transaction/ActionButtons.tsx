import { ArrowLeft, Share2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";

interface ActionButtonsProps {
  onShareProof: () => void;
  onBackToDashboard: () => void;
}

export const ActionButtons = ({
  onShareProof,
  onBackToDashboard,
}: ActionButtonsProps) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400, delay: 1500 }}
      className="mt-8 gap-4"
    >
      <Pressable
        onPress={onShareProof}
        className="w-full py-4 rounded-xl items-center justify-center active:opacity-80 border border-muted/35"
      >
        <View className="flex-row items-center gap-2">
          <Share2 size={20} color={COLORS.primary} />
          <Text className="font-semibold text-primary">Share Proof</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onBackToDashboard}
        className="w-full py-3 items-center justify-center"
      >
        <View className="flex-row items-center gap-2">
          <ArrowLeft size={16} color={COLORS.muted} />
          <Text className="text-base text-muted">Back to Dashboard</Text>
        </View>
      </Pressable>
    </MotiView>
  );
};
