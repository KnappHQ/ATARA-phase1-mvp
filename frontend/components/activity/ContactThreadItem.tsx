import { ChevronRight, Scale } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";
import { ContactThread } from "@/stores/useTransactionHistoryStore";

interface ContactThreadItemProps {
  thread: ContactThread;
  index: number;
  onPress: (thread: ContactThread) => void;
}

export const ContactThreadItem = ({
  thread,
  index,
  onPress,
}: ContactThreadItemProps) => {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 150, delay: index * 50 }}
    >
      <Pressable
        onPress={() => onPress(thread)}
        className="p-4 rounded-2xl mb-2 active:opacity-70 border bg-white/5 border-white/15"
      >
        <View className="flex-row items-center gap-4">
          <View className="w-12 h-12 rounded-full items-center justify-center bg-white/10 border border-white/20">
            <Text className="text-base font-medium text-white">
              {(thread.displayName.startsWith("@")
                ? thread.displayName.slice(1)
                : thread.displayName
              )
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-1 flex-row items-center">
                <Text
                  className="text-base font-medium text-white"
                  numberOfLines={1}
                >
                  {thread.displayName}
                </Text>
              </View>
              <Text className="text-sm ml-2 text-white/40">
                {thread.lastTime}
              </Text>
            </View>

            <Text className="text-sm mb-1 text-white/40" numberOfLines={1}>
              {thread.lastNote || thread.lastMessage}
            </Text>

            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-xs uppercase tracking-wide text-white/30">
                {thread.transactionCount} transaction
                {thread.transactionCount !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          <ChevronRight size={16} color="rgba(255, 255, 255, 0.2)" />
        </View>
      </Pressable>
    </MotiView>
  );
};
