import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Send } from "lucide-react-native";
import { MotiView } from "moti";
import { FinancialSummary } from "@/components/activity/FinancialSummary";
import { COLORS } from "@/utils/constants";

const truncateAddress = (address: string) => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function ContactDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Parse contact data from params
  const contact = params.address
    ? {
        address: params.address as string,
        displayName: params.displayName as string,
        totalReceived: parseFloat(params.totalReceived as string) || 0,
        totalSent: parseFloat(params.totalSent as string) || 0,
        transactions: JSON.parse((params.transactions as string) || "[]"),
      }
    : null;

  const handleBack = () => {
    router.back();
  };

  const handleSendToContact = () => {
    if (!contact) return;
    router.push({
      pathname: "/send",
      params: {
        preselectedName: contact.displayName,
        preselectedAddress: contact.address,
      },
    });
  };

  const handleTransactionClick = (tx: any) => {
    router.push({
      pathname: "/transaction-detail",
      params: {
        id: tx.id,
        name: tx.name,
        address: tx.address,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
        note: tx.note || "",
      },
    });
  };

  if (!contact) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white/60">No contact data</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="flex-row items-center gap-4 mb-4 px-6 pt-4">
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 rounded-2xl items-center justify-center active:opacity-70"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <ArrowLeft size={20} color="rgba(255, 255, 255, 0.8)" />
            </Pressable>
            <View className="flex-row items-center gap-3 flex-1">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 2,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: COLORS.white }}
                >
                  {contact.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text
                  className="text-base font-semibold"
                  style={{ color: COLORS.white }}
                >
                  @{contact.displayName.toLowerCase().replace(/\s/g, "")}
                </Text>
                <Text
                  className="text-xs font-mono"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  {truncateAddress(contact.address)}
                </Text>
              </View>
            </View>
          </View>

          {/* Financial Summary */}
          <View className="px-6">
            <FinancialSummary
              totalReceived={contact.totalReceived}
              totalSent={contact.totalSent}
              contactName={contact.displayName}
            />
          </View>

          {/* Transaction Chat Bubbles */}
          <View className="mb-24 px-6">
            {contact.transactions.map((tx: any, index: number) => {
              const isReceive = tx.type === "receive";

              return (
                <MotiView
                  key={tx.id}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{
                    type: "timing",
                    duration: 150,
                    delay: index * 30,
                  }}
                  className={`mb-3 ${isReceive ? "items-start" : "items-end"}`}
                >
                  <Pressable
                    onPress={() => handleTransactionClick(tx)}
                    className="max-w-[75%] p-4 rounded-2xl active:opacity-70"
                    style={{
                      backgroundColor: isReceive
                        ? `${COLORS.accent}1A`
                        : "rgba(255, 255, 255, 0.05)",
                      borderWidth: 1,
                      borderColor: isReceive
                        ? `${COLORS.accent}33`
                        : "rgba(255, 255, 255, 0.15)",
                    }}
                  >
                    <Text
                      className="font-mono text-lg font-medium mb-1"
                      style={{
                        color: isReceive
                          ? COLORS.accent
                          : "rgba(255, 255, 255, 0.6)",
                      }}
                    >
                      {tx.amount}
                    </Text>

                    {tx.note && (
                      <Text
                        className="text-sm mb-2"
                        style={{ color: "rgba(255, 255, 255, 0.6)" }}
                      >
                        {tx.note}
                      </Text>
                    )}

                    <Text
                      className="text-[10px]"
                      style={{ color: "rgba(255, 255, 255, 0.3)" }}
                    >
                      {tx.date} • {tx.time}
                    </Text>
                  </Pressable>
                </MotiView>
              );
            })}
          </View>
        </ScrollView>

        {/* Fixed Send Button at Bottom */}
        <View
          className="absolute bottom-0 left-0 right-0 px-6 pb-6"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            ...(Platform.OS === "ios" && {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            }),
          }}
        >
          <Pressable
            onPress={handleSendToContact}
            className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2 active:opacity-80"
            style={{
              backgroundColor: COLORS.accent,
            }}
          >
            <Send size={16} color={COLORS.white} />
            <Text
              className="font-mono text-sm font-medium"
              style={{ color: COLORS.white }}
            >
              Send to {contact.displayName.split(" ")[0]}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
