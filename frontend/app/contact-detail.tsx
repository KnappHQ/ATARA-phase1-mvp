import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Send } from "lucide-react-native";
import { MotiView } from "moti";
import { FinancialSummary } from "@/components/activity/FinancialSummary";
import { COLORS } from "@/utils/constants";
import { DisplayTransaction } from "@/stores/useTransactionHistoryStore";

const truncateAddress = (address: string) => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
};

export default function ContactDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();

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

  const handleTransactionClick = (tx: DisplayTransaction) => {
    router.push({
      pathname: "/transaction-detail",
      params: {
        id: tx.id,
        name: tx.counterparty.name,
        address: tx.counterparty.address,
        amount: tx.formattedAmount,
        date: tx.displayDate,
        type: tx.type,
        note: tx.userNote || "",
        category: tx.category || "",
        isInApp: tx.isInApp.toString(),
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
          <View className="flex-row items-center gap-4 mb-4 px-6 pt-4">
            <Pressable
              onPress={handleBack}
              className="w-12 h-12 rounded-full items-center justify-center active:opacity-70"
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
                className="w-12 h-12 rounded-full items-center justify-center"
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
                  className="text-xl font-semibold"
                  style={{ color: COLORS.white }}
                >
                  {contact.displayName.toLowerCase().replace(/\s/g, "")}
                </Text>
                <Text
                  className="text-sm font-mono"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  {truncateAddress(contact.address)}
                </Text>
              </View>
            </View>
          </View>

          <View className="px-6">
            <FinancialSummary
              totalReceived={contact.totalReceived}
              totalSent={contact.totalSent}
              contactName={contact.displayName}
            />
          </View>

          {/* Transaction Chat Bubbles */}
          <View className="mb-24 px-6">
            {contact.transactions.map(
              (tx: DisplayTransaction, index: number) => {
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
                      className="p-4 rounded-2xl active:opacity-70"
                      style={{
                        width: 180,
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
                        {tx.formattedAmount}
                      </Text>

                      <Text
                        className="text-[10px]"
                        style={{ color: "rgba(255, 255, 255, 0.3)" }}
                      >
                        {tx.displayDateShort} • {tx.displayTime}
                      </Text>
                    </Pressable>
                  </MotiView>
                );
              },
            )}
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
