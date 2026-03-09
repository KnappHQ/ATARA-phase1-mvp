import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Wine,
  Utensils,
  ShoppingBag,
  ArrowLeftRight,
  MoreHorizontal,
  Wifi,
} from "lucide-react-native";
import { MotiView } from "moti";
import { FinancialSummary } from "@/components/activity/FinancialSummary";
import { COLORS } from "@/utils/constants";
import {
  DisplayTransaction,
  useTransactionHistoryStore,
} from "@/stores/useTransactionHistoryStore";

const truncateAddress = (address: string) => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
};

const CATEGORY_ICONS: Record<string, any> = {
  drinks: Wine,
  food: Utensils,
  shopping: ShoppingBag,
  transfer: ArrowLeftRight,
  other: MoreHorizontal,
  // legacy aliases
  native: ArrowLeftRight,
  erc20: ArrowLeftRight,
};

const getCategoryLabel = (category: string | null) => {
  if (!category || category === "native" || category === "erc20")
    return "Transfer";
  return category.charAt(0).toUpperCase() + category.slice(1);
};

export default function ContactDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const contactThreads = useTransactionHistoryStore((s) => s.contactThreads);

  const address = params.address as string;
  const thread = contactThreads.find((t) => t.address === address);

  const contact = address
    ? {
        address,
        displayName: (thread?.displayName ?? params.displayName) as string,
        totalReceived: thread?.totalReceived ?? 0,
        totalSent: thread?.totalSent ?? 0,
        transactions: thread?.transactions ?? [],
      }
    : null;

  const handleBack = () => {
    router.back();
  };

  const handleSendToContact = () => {
    if (!contact) return;
    const handle = contact.displayName.startsWith("@")
      ? contact.displayName.slice(1)
      : contact.displayName;
    router.push({
      pathname: "/send",
      params: {
        contactId: contact.address,
        contactHandle: handle,
        contactName: handle,
        contactSmartAddress: contact.address,
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
        handle: tx.counterparty.handle || "",
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
                  {contact.displayName
                    .replace(/^@/, "")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View>
                <View className="flex-row items-center gap-2">
                  <Text
                    className="text-xl font-semibold"
                    style={{ color: COLORS.white }}
                  >
                    {contact.displayName}
                  </Text>
                  {contact.transactions[0] &&
                    !contact.transactions[0].isInApp && (
                      <View
                        className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "rgba(250,204,21,0.08)",
                          borderWidth: 1,
                          borderColor: "rgba(250,204,21,0.2)",
                        }}
                      >
                        <Wifi size={9} color="rgba(250,204,21,0.7)" />
                        <Text
                          className="text-[9px] uppercase font-medium"
                          style={{
                            color: "rgba(250,204,21,0.7)",
                            letterSpacing: 0.8,
                          }}
                        >
                          External
                        </Text>
                      </View>
                    )}
                </View>
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

          <View className="mb-24 px-6">
            {contact.transactions.map(
              (tx: DisplayTransaction, index: number) => {
                const isReceive = tx.type === "receive";
                const CategoryIcon =
                  CATEGORY_ICONS[(tx.category || "other").toLowerCase()] ??
                  MoreHorizontal;
                const categoryLabel = getCategoryLabel(tx.category);

                return (
                  <MotiView
                    key={tx.id}
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{
                      type: "timing",
                      duration: 150,
                      delay: index * 30,
                    }}
                    className="mb-3"
                  >
                    <Pressable
                      onPress={() => handleTransactionClick(tx)}
                      className="rounded-2xl active:opacity-70"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.04)",
                        borderWidth: 1,
                        borderColor: isReceive
                          ? `${COLORS.emarald}25`
                          : "rgba(255, 255, 255, 0.09)",
                      }}
                    >
                      <View className="flex-row items-center gap-3 px-4 pt-4 pb-3">
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{
                            backgroundColor: isReceive
                              ? `${COLORS.emarald}15`
                              : "rgba(255,255,255,0.06)",
                            borderWidth: 1,
                            borderColor: isReceive
                              ? `${COLORS.emarald}30`
                              : "rgba(255,255,255,0.1)",
                          }}
                        >
                          {isReceive ? (
                            <ArrowDownLeft size={16} color={COLORS.emarald} />
                          ) : (
                            <ArrowUpRight
                              size={16}
                              color="rgba(255,255,255,0.5)"
                            />
                          )}
                        </View>

                        <View className="flex-1">
                          <Text
                            className="text-base font-semibold mb-0.5"
                            style={{
                              color: isReceive
                                ? COLORS.emarald
                                : COLORS.platinum,
                            }}
                          >
                            {tx.formattedAmount}
                          </Text>
                          <Text
                            className="text-xs"
                            style={{ color: "rgba(255,255,255,0.35)" }}
                          >
                            {tx.displayDateShort} · {tx.displayTime}
                          </Text>
                        </View>

                        <View
                          className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.06)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.1)",
                          }}
                        >
                          <CategoryIcon
                            size={10}
                            color="rgba(255,255,255,0.4)"
                          />
                          <Text
                            className="text-[9px] uppercase font-medium"
                            style={{
                              color: "rgba(255,255,255,0.4)",
                              letterSpacing: 0.8,
                            }}
                          >
                            {categoryLabel}
                          </Text>
                        </View>
                      </View>

                      {/* Note row — only if note exists */}
                      {!!tx.userNote && (
                        <View
                          className="mx-4 mb-3 px-3 py-2 rounded-xl"
                          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                        >
                          <Text
                            className="text-xs italic"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                            numberOfLines={2}
                          >
                            "{tx.userNote}"
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </MotiView>
                );
              },
            )}
          </View>
        </ScrollView>

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
