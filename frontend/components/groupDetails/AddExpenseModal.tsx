import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MotiView } from "moti";
import { X, DollarSign, FileText } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";
import { useGroupStore } from "@/stores/useGroupStore";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  memberCount: number;
}

export const AddExpenseModal = ({
  isOpen,
  onClose,
  groupId,
  memberCount,
}: AddExpenseModalProps) => {
  const { addExpense } = useGroupStore();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid =
    description.trim().length > 0 && parseFloat(amount) > 0 && !isSubmitting;

  const handleAdd = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await addExpense(groupId, description.trim(), parseFloat(amount));
      setDescription("");
      setAmount("");
      onClose();
    } catch (err: any) {
      console.error("Failed to add expense:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDescription("");
    setAmount("");
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleClose}
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      >
        <TouchableOpacity activeOpacity={1}>
          <MotiView
            from={{ translateY: 80, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{
              backgroundColor: "#0a0a0a",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: `${COLORS.white}18`,
              paddingBottom: 40,
            }}
          >
            <View className="items-center pt-3 pb-1">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: `${COLORS.white}20` }}
              />
            </View>

            <View className="flex-row items-center justify-between px-6 pt-3 pb-5">
              <View className="flex-row items-center gap-2">
                <DollarSign size={16} color={`${COLORS.white}80`} />
                <Text
                  className="text-xs font-mono uppercase"
                  style={{ color: `${COLORS.white}80`, letterSpacing: 2 }}
                >
                  Add Expense
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                className="w-7 h-7 rounded-full items-center justify-center"
                style={{
                  backgroundColor: `${COLORS.white}08`,
                  borderWidth: 1,
                  borderColor: `${COLORS.white}15`,
                }}
              >
                <X size={14} color={`${COLORS.white}99`} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View className="px-6 gap-5">
                <View>
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <FileText size={12} color={`${COLORS.white}66`} />
                    <Text
                      className="text-xs font-mono uppercase tracking-wide"
                      style={{ color: `${COLORS.white}66` }}
                    >
                      Description
                    </Text>
                  </View>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g., Dinner, Taxi, Hotel"
                    placeholderTextColor={`${COLORS.white}30`}
                    className="px-4 py-4 rounded-2xl text-base text-white"
                    style={{
                      backgroundColor: `${COLORS.white}06`,
                      borderWidth: 1,
                      borderColor: `${COLORS.white}15`,
                      opacity: isSubmitting ? 0.5 : 1,
                    }}
                    autoFocus
                    editable={!isSubmitting}
                  />
                </View>

                <View>
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <DollarSign size={12} color={`${COLORS.white}66`} />
                    <Text
                      className="text-xs font-mono uppercase tracking-wide"
                      style={{ color: `${COLORS.white}66` }}
                    >
                      Amount
                    </Text>
                  </View>
                  <View
                    className="flex-row items-center px-4 rounded-2xl"
                    style={{
                      backgroundColor: `${COLORS.white}06`,
                      borderWidth: 1,
                      borderColor: `${COLORS.white}15`,
                    }}
                  >
                    <Text
                      className="text-xl font-mono"
                      style={{ color: `${COLORS.white}40` }}
                    >
                      $
                    </Text>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      placeholderTextColor={`${COLORS.white}30`}
                      keyboardType="decimal-pad"
                      className="flex-1 px-2 py-4 text-xl font-mono text-white"
                      editable={!isSubmitting}
                      style={{ opacity: isSubmitting ? 0.5 : 1 }}
                    />
                  </View>
                </View>

                {parseFloat(amount) > 0 && memberCount > 0 && (
                  <MotiView
                    from={{ opacity: 0, translateY: 4 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: "timing", duration: 150 }}
                    className="px-4 py-3 rounded-2xl"
                    style={{
                      backgroundColor: `${COLORS.white}04`,
                      borderWidth: 1,
                      borderColor: `${COLORS.white}0e`,
                    }}
                  >
                    <Text
                      className="text-xs font-mono text-center"
                      style={{ color: `${COLORS.white}50` }}
                    >
                      Split equally ·{" "}
                      <Text style={{ color: `${COLORS.white}80` }}>
                        ${(parseFloat(amount) / memberCount).toFixed(2)} each
                      </Text>{" "}
                      across {memberCount} members
                    </Text>
                  </MotiView>
                )}

                <View className="flex-row gap-3 pb-2">
                  <Pressable
                    onPress={handleClose}
                    className="flex-1 py-4 rounded-2xl items-center active:opacity-70"
                    style={{
                      backgroundColor: `${COLORS.white}08`,
                      borderWidth: 1,
                      borderColor: `${COLORS.white}15`,
                    }}
                  >
                    <Text
                      className="text-sm font-mono"
                      style={{ color: `${COLORS.white}80` }}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAdd}
                    disabled={!isValid}
                    className="flex-1 py-4 rounded-2xl items-center active:opacity-80"
                    style={{
                      backgroundColor: isValid
                        ? COLORS.platinum
                        : `${COLORS.platinum}40`,
                    }}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text className="text-sm font-mono font-semibold text-black">
                        Add Expense
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </MotiView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
