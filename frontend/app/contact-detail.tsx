import { useState, useEffect } from "react";
import { GroupService } from "@/services/group.service";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView, Platform, Share, Alert } from "react-native";
import * as Haptics from "expo-haptics";
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
import { SafetySheet } from "@/components/safety/SafetySheet";
import type { SafetyContext } from "@/utils/safetyFlow";
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
  const [debts, setDebts] = useState<Awaited<ReturnType<typeof GroupService.contactBalances>> | null>(null);
  const [debtError, setDebtError] = useState(false);
  const [reminding, setReminding] = useState(false);
  useEffect(() => {
    let active = true; setDebts(null); setDebtError(false);
    if (address) GroupService.contactBalances(address).then(result => { if (active) setDebts(result); }).catch(() => { if (active) setDebtError(true); });
    return () => { active = false; };
  }, [address]);
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

  // Only people who use ATARA have a handle to report or block.
  const safetyHandle =
    contact?.transactions.find((tx) => tx.isInApp && tx.counterparty.handle)?.counterparty.handle ?? null;
  const [safety, setSafety] = useState<{ handle: string; context: SafetyContext } | null>(null);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleSendToContact = () => {
    if (!contact) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const owedToMe = debts?.reduce((sum, balance) => sum + balance.owedToMe, 0) ?? 0;
  // The reminder travels through whatever messenger the person picks, so it
  // carries no amount, no name and no link. It used to create a public payment
  // link: paying it never settled the group shares, so the debt stayed open
  // and invited a second payment. Settling in Groups marks the shares paid.
  const handleRepaymentReminder = async () => {
    if (reminding || owedToMe <= 0) return;
    setReminding(true);
    try {
      await Share.share({
        message:
          "Hi! A friendly reminder about our shared expenses on ATARA. You can check the shares you accepted and settle them in the app, under Groups.",
      });
    } catch (error: any) {
      Alert.alert("Reminder not sent", error?.message ?? "Try again in a moment.");
    } finally { setReminding(false); }
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
              <View style={{ flex: 1, minWidth: 0 }}>
                <View className="flex-row items-center gap-2">
                  <Text
                    className="text-xl font-semibold"
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.6}
                    style={{ color: COLORS.white, flexShrink: 1 }}
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
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  maxFontSizeMultiplier={1.6}
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  {truncateAddress(contact.address)}
                </Text>
              </View>
            </View>
            {safetyHandle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Report or block @${safetyHandle}`}
                onPress={() => setSafety({ handle: safetyHandle, context: { kind: "contact" } })}
                className="w-12 h-12 rounded-full items-center justify-center active:opacity-70"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.15)" }}
              >
                <MoreHorizontal size={20} color="rgba(255, 255, 255, 0.8)" />
              </Pressable>
            ) : null}
          </View>

          <View className="px-6">
            <FinancialSummary
              totalReceived={contact.totalReceived}
              totalSent={contact.totalSent}
              contactName={contact.displayName}
            />
          </View>

          <View className="mx-6 mb-6 rounded-2xl border border-white/10 p-4">
            <Text className="text-white font-semibold mb-2">Accepted shares in Groups</Text>
            {debtError ? <Text className="text-white/50">Balances unavailable. Check Groups before paying.</Text> : debts === null ? <Text className="text-white/50">Loading…</Text> : debts.length === 0 ? <Text className="text-white/50">No accepted shares to settle.</Text> : debts.map(d => <Text key={d.assetSymbol} className="text-white/70 mb-2">You owe {d.owedByMe.toFixed(2)} {d.assetSymbol} · Owes you {d.owedToMe.toFixed(2)} {d.assetSymbol}</Text>)}
            {owedToMe > 0 && <Pressable disabled={reminding} onPress={handleRepaymentReminder} className="mt-2 rounded-xl p-3" style={{ backgroundColor: `${COLORS.accent}20`, opacity: reminding ? .5 : 1 }}><Text style={{ color: COLORS.accent }} className="text-center font-semibold">{reminding ? "Preparing reminder…" : "Send a repayment reminder"}</Text></Pressable>}
            {owedToMe > 0 && <Text className="text-white/40 text-xs mt-2">The message has no amount, name or payment link. They settle in Groups, which marks the shares as paid.</Text>}
            <Pressable onPress={() => router.push("/(tabs)/activity")}><Text style={{ color: COLORS.accent }} className="mt-2">Open Activity and Groups</Text></Pressable>
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

                        <View className="flex-1" style={{ minWidth: 0 }}>
                          <Text
                            className="text-base font-semibold mb-0.5"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                            maxFontSizeMultiplier={1.6}
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
                      {!tx.userNote && tx.noteHidden && (
                        <View className="mx-4 mb-3 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                          <Text className="text-xs italic" style={{ color: "rgba(255,255,255,0.4)" }}>
                            Note hidden
                          </Text>
                        </View>
                      )}
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
                            {`“${tx.userNote}”`}
                          </Text>
                          {isReceive && tx.isInApp && tx.counterparty.handle ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Report this note"
                              hitSlop={8}
                              onPress={() => setSafety({ handle: tx.counterparty.handle as string, context: { kind: "payment_note", id: tx.id } })}
                              className="mt-1 self-start"
                            >
                              <Text className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Report this note</Text>
                            </Pressable>
                          ) : null}
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
      <SafetySheet
        visible={!!safety}
        handle={safety?.handle ?? ""}
        context={safety?.context ?? { kind: "contact" }}
        onClose={() => setSafety(null)}
        onBlocked={() => router.back()}
      />
    </View>
  );
}
