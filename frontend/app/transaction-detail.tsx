import { useState, useEffect, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { X, Check, Pencil, ArrowLeft, Info } from "lucide-react-native";
import { COLORS, CATEGORIES } from "@/utils/constants";
import * as Haptics from "expo-haptics";
import { useAddressBookStore } from "@/stores/useAddressBookStore";
import { NicknameEditModal } from "@/components/transaction/NicknameEditModal";
import { HistoryService } from "@/services/history.service";
import { useTransactionHistoryStore } from "@/stores/useTransactionHistoryStore";

const truncateAddress = (address: string) => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
};

export default function TransactionDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedCategory, setSelectedCategory] = useState("transfer");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const { getDisplayName, hasNickname, setNickname, removeNickname } =
    useAddressBookStore();

  const transaction = useMemo(
    () =>
      params.id
        ? {
            id: params.id as string,
            name: params.name as string,
            address: params.address as string,
            handle: (params.handle as string) || "",
            amount: params.amount as string,
            date: params.date as string,
            type: params.type as "receive" | "send",
            status:
              (params.status as "Confirmed" | "Pending" | "Failed") ||
              "Confirmed",
            category: params.category as string,
            note: params.note as string,
            isInApp: params.isInApp === "true",
          }
        : null,
    [params.id],
  );

  useEffect(() => {
    if (transaction) {
      const validCategories = CATEGORIES.map((c) => c.id);
      const category =
        transaction.category && validCategories.includes(transaction.category)
          ? transaction.category
          : "transfer";
      setSelectedCategory(category);
      setNote(transaction.note || "");
    }
  }, [params.id]);

  const handleBack = () => {
    router.back();
  };

  const handleSave = async () => {
    if (!transaction) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await HistoryService.updateTransaction({
        transactionId: transaction.id,
        category: selectedCategory,
        userNote: note,
      });

      // Patch the store in-place — no network round-trip
      const { updateLocalTransaction } = useTransactionHistoryStore.getState();
      updateLocalTransaction(transaction.id, {
        category: selectedCategory,
        userNote: note || null,
      });

      router.back();
    } catch (error: any) {
      console.error("Failed to update transaction:", error);
      // TODO: Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  if (!transaction) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white/60">No transaction data</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 200 }}
            className="flex-row items-center justify-between px-6 pt-4 pb-4"
          >
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <ArrowLeft size={20} color="rgba(255, 255, 255, 0.8)" />
            </Pressable>
            <Text
              className="text-sm uppercase text-white/80"
              style={{ letterSpacing: 1.5 }}
            >
              Transaction
            </Text>
            <View className="w-10" />
          </MotiView>

          <MotiView
            from={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "timing", duration: 200, delay: 50 }}
            className="items-center mb-8 pt-4 px-6"
          >
            <Text
              className="text-5xl font-bold mb-3"
              style={{
                color:
                  transaction.type === "receive"
                    ? COLORS.emarald
                    : COLORS.platinum,
              }}
            >
              {transaction.amount}
            </Text>

            {transaction.address ? (
              <View className="items-center gap-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base text-platinum font-medium">
                    {hasNickname(transaction.address)
                      ? getDisplayName(transaction.address)
                      : transaction.name}
                  </Text>
                  {!transaction.handle && (
                    <TouchableOpacity
                      onPress={() => setIsNicknameModalOpen(true)}
                      activeOpacity={0.7}
                      className="w-7 h-7 rounded-full items-center justify-center border border-platinum/20"
                      style={{ backgroundColor: "rgba(245, 245, 240, 0.1)" }}
                    >
                      <Pencil size={14} color="rgba(245, 245, 240, 0.7)" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text
                  className="text-sm text-white/40"
                  style={{ letterSpacing: 1.4 }}
                >
                  {truncateAddress(transaction.address)}
                </Text>
              </View>
            ) : (
              <Text className="text-base text-white/60">
                {transaction.name}
              </Text>
            )}
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 200, delay: 100 }}
            className="px-6 mb-6"
          >
            <Text
              className="text-xs uppercase text-platinum/80 mb-3"
              style={{ letterSpacing: 2.5 }}
            >
              Details
            </Text>
            <View
              className="p-5 rounded-xl"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text
                    className="text-sm uppercase text-white/60 mb-2"
                    style={{ letterSpacing: 1 }}
                  >
                    Date
                  </Text>
                  <Text className="text-base text-white">
                    {transaction.date}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className="text-sm uppercase text-white/60 mb-2"
                    style={{ letterSpacing: 1 }}
                  >
                    Status
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: COLORS.emarald,
                        shadowColor: COLORS.emarald,
                        shadowOpacity: 0.6,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 },
                      }}
                    />
                    <Text className="text-base text-white">
                      {transaction.status || "Confirmed"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 200, delay: 150 }}
            className="px-6 mb-6"
          >
            <Text
              className="text-xs uppercase text-platinum/80 mb-3"
              style={{ letterSpacing: 2.5 }}
            >
              Category
            </Text>
            <View
              className="flex-row justify-between gap-1.5"
              style={{ opacity: 1 }}
            >
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategory === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => {
                      if (!transaction.isInApp) return;
                      setSelectedCategory(category.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                    className="flex-1 flex-col items-center gap-1.5 py-3 rounded-xl"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(255, 255, 255, 0.02)",
                      borderWidth: 1,
                      borderColor: isSelected
                        ? "rgba(255, 255, 255, 0.3)"
                        : "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <View className="relative">
                      <Icon
                        size={20}
                        color={
                          isSelected
                            ? COLORS.platinum
                            : "rgba(255, 255, 255, 0.4)"
                        }
                      />
                      {isSelected && (
                        <View
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full items-center justify-center"
                          style={{ backgroundColor: COLORS.platinum }}
                        >
                          <Check size={8} color={COLORS.black} />
                        </View>
                      )}
                    </View>
                    <Text
                      className="text-[9px] uppercase"
                      style={{
                        color: isSelected
                          ? COLORS.platinum
                          : "rgba(255, 255, 255, 0.4)",
                        letterSpacing: 1,
                      }}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 200, delay: 200 }}
            className="px-6 mb-8"
          >
            <Text
              className="text-xs uppercase text-platinum/80 mb-3"
              style={{ letterSpacing: 2.5 }}
            >
              Note
            </Text>
            <View
              className="px-4 py-2 rounded-2xl"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                opacity: 1,
              }}
            >
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a personal memo..."
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                className="text-lg text-white"
                multiline
                editable={transaction.isInApp}
              />
            </View>
          </MotiView>

          <View className="px-6">
            {!transaction.isInApp && (
              <View
                className="flex-row items-start gap-2.5 mb-4 px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Info
                  size={14}
                  color="rgba(255, 255, 255, 0.35)"
                  style={{ marginTop: 1 }}
                />
                <Text
                  className="flex-1 text-xs text-white/40 leading-5"
                  style={{ letterSpacing: 0.3 }}
                >
                  On-chain transactions are immutable. Category and notes cannot
                  be saved for external transfers.
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving || !transaction.isInApp}
              activeOpacity={0.8}
              className="w-full py-5 rounded-2xl items-center"
              style={{
                backgroundColor: COLORS.accent,
                opacity: isSaving || !transaction.isInApp ? 0.7 : 1,
              }}
            >
              <Text
                className="text-base uppercase font-semibold"
                style={{ color: COLORS.white, letterSpacing: 1.5 }}
              >
                {isSaving ? "Updating..." : "Update Transaction"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {transaction?.address && (
        <NicknameEditModal
          isOpen={isNicknameModalOpen}
          onClose={() => setIsNicknameModalOpen(false)}
          address={transaction.address}
          currentNickname={
            hasNickname(transaction.address)
              ? getDisplayName(transaction.address)
              : ""
          }
          onSave={(address, nickname) => {
            setNickname(address, nickname);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          onRemove={removeNickname}
        />
      )}
    </View>
  );
}
