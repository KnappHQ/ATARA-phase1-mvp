import { ChevronRight, Scale, ArrowUp, ArrowDown } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";
import { ContactThread } from "./ContactsTab";

interface ContactThreadItemProps {
  thread: ContactThread;
  index: number;
  onPress: (thread: ContactThread) => void;
}

const truncateAddress = (address: string) => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const ContactThreadItem = ({
  thread,
  index,
  onPress,
}: ContactThreadItemProps) => {
  const netBalance = thread.totalReceived - thread.totalSent;
  const isSettled = Math.abs(netBalance) < 0.01;
  const youOwe = netBalance > 0;
  const absoluteBalance = Math.abs(netBalance);

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
              {thread.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-1 flex-row items-center">
                <Text
                  className="text-base font-medium text-white"
                  numberOfLines={1}
                >
                  @{thread.displayName.toLowerCase().replace(/\s/g, "")}
                </Text>
                {/* <Text className="text-xs font-mono ml-2 text-white/30">
                  {truncateAddress(thread.address)}
                </Text> */}
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

              {isSettled ? (
                <View className="flex-row items-center gap-1">
                  <Scale size={12} color="rgba(255, 255, 255, 0.3)" />
                  <Text
                    className="font-mono text-[10px]"
                    style={{ color: "rgba(255, 255, 255, 0.3)" }}
                  >
                    Square
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-1">
                  {youOwe ? (
                    <>
                      <ArrowUp size={14} color="rgba(255, 255, 255, 0.5)" />
                      <Text className="font-mono text-sm text-white/50">
                        -$
                        {absoluteBalance.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </Text>
                    </>
                  ) : (
                    <>
                      <ArrowDown size={14} color={COLORS.accent} />
                      <Text className="font-mono text-sm text-accent">
                        +$
                        {absoluteBalance.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          </View>

          <ChevronRight size={16} color="rgba(255, 255, 255, 0.2)" />
        </View>
      </Pressable>
    </MotiView>
  );
};
