import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import { MotiView, AnimatePresence } from "moti";
import {
  X,
  Check,
  Wine,
  Coffee,
  ShoppingBag,
  Utensils,
  ArrowLeftRight,
  MoreHorizontal,
  Pencil,
} from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAddressBookStore } from "@/stores/useAddressBookStore";
import { NicknameEditModal } from "./NicknameEditModal";

const truncateAddress = (address: string) => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

interface TransactionData {
  id: string;
  name: string;
  address?: string;
  amount: string;
  date: string;
  type: "receive" | "send";
  status?: "Confirmed" | "Pending" | "Failed";
  category?: string;
  note?: string;
}

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData | null;
  onSave?: (id: string, category: string, note: string) => void;
}

interface Category {
  id: string;
  label: string;
  icon: any;
}

const CATEGORIES: Category[] = [
  { id: "drinks", label: "Drinks", icon: Wine },
  { id: "food", label: "Food", icon: Utensils },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

export const TransactionDetailModal = ({
  isOpen,
  onClose,
  transaction,
  onSave,
}: TransactionDetailModalProps) => {
  const [selectedCategory, setSelectedCategory] = useState(
    transaction?.category || "other",
  );
  const [note, setNote] = useState(transaction?.note || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const { getDisplayName, hasNickname, setNickname, removeNickname } =
    useAddressBookStore();

  useEffect(() => {
    if (transaction) {
      setSelectedCategory(transaction.category || "other");
      setNote(transaction.note || "");
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await new Promise((resolve) => setTimeout(resolve, 500));

    onSave?.(transaction.id, selectedCategory, note);

    setIsSaving(false);
    onClose();
  };

  if (!transaction) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-black">
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
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="w-10 h-10 rounded-full items-center justify-center border border-white/20"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.03)",
              }}
            >
              <X size={20} color="rgba(255, 255, 255, 0.8)" />
            </TouchableOpacity>
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
                    ? COLORS.sapphire
                    : COLORS.platinum,
              }}
            >
              {transaction.amount}
            </Text>

            {transaction.address ? (
              <View className="items-center gap-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base text-platinum font-medium">
                    @
                    {(hasNickname(transaction.address)
                      ? getDisplayName(transaction.address)
                      : transaction.name
                    )
                      .toLowerCase()
                      .replace(/\s/g, "")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsNicknameModalOpen(true)}
                    activeOpacity={0.7}
                    className="w-7 h-7 rounded-full items-center justify-center border border-platinum/20"
                    style={{ backgroundColor: "rgba(245, 245, 240, 0.1)" }}
                  >
                    <Pencil size={14} color="rgba(245, 245, 240, 0.7)" />
                  </TouchableOpacity>
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
                @{transaction.name.toLowerCase().replace(/\s/g, "")}
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
                        backgroundColor: COLORS.sapphire,
                        shadowColor: COLORS.sapphire,
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
            <View className="flex-row justify-between gap-1.5">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategory === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => {
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
              }}
            >
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a personal memo..."
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                className="text-lg text-white"
                multiline
              />
            </View>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: isSaving ? 0.7 : 1, translateY: 0 }}
            transition={{ type: "timing", duration: 200, delay: 250 }}
            className="px-6"
          >
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
              className="w-full py-5 rounded-2xl items-center relative overflow-hidden"
              style={{
                backgroundColor: COLORS.accent,
                shadowColor: COLORS.platinum,
                shadowOpacity: 0.2,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 0 },
                elevation: 10,
              }}
            >
              <Text
                className="text-base uppercase font-semibold"
                style={{ color: COLORS.white, letterSpacing: 1.5 }}
              >
                {isSaving ? "Updating..." : "Update Transaction"}
              </Text>
            </TouchableOpacity>
          </MotiView>
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
    </Modal>
  );
};
