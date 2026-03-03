import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { MotiView } from "moti";
import { X, DollarSign, FileText, User } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";
import { GroupMember } from "@/hooks/useGroups";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: GroupMember[];
  onAdd: (
    paidById: string,
    paidByName: string,
    amount: number,
    description: string,
  ) => void;
}

export const AddExpenseModal = ({
  isOpen,
  onClose,
  members,
  onAdd,
}: AddExpenseModalProps) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState(members[0]?.id ?? "");

  const isValid =
    description.trim().length > 0 &&
    parseFloat(amount) > 0 &&
    paidById.length > 0;

  const handleAdd = () => {
    if (!isValid) return;
    const member = members.find((m) => m.id === paidById);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd(paidById, member?.name ?? "", parseFloat(amount), description.trim());
    // reset
    setDescription("");
    setAmount("");
    setPaidById(members[0]?.id ?? "");
    onClose();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDescription("");
    setAmount("");
    setPaidById(members[0]?.id ?? "");
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
                    }}
                    autoFocus
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
                    />
                  </View>
                </View>

                <View>
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <User size={12} color={`${COLORS.white}66`} />
                    <Text
                      className="text-xs font-mono uppercase tracking-wide"
                      style={{ color: `${COLORS.white}66` }}
                    >
                      Paid By
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {members.map((member) => {
                      const active = paidById === member.id;
                      return (
                        <Pressable
                          key={member.id}
                          onPress={() => setPaidById(member.id)}
                          className="flex-row items-center gap-2 px-3 py-2.5 rounded-2xl"
                          style={{
                            backgroundColor: active
                              ? `${COLORS.platinum}22`
                              : `${COLORS.white}06`,
                            borderWidth: 1,
                            borderColor: active
                              ? `${COLORS.platinum}66`
                              : `${COLORS.white}15`,
                          }}
                        >
                          <View
                            className="w-6 h-6 rounded-full items-center justify-center"
                            style={{
                              backgroundColor: active
                                ? `${COLORS.platinum}44`
                                : `${COLORS.white}10`,
                            }}
                          >
                            <Text className="text-[9px] font-semibold text-white">
                              {member.avatar}
                            </Text>
                          </View>
                          <Text
                            className="text-sm font-medium"
                            style={{
                              color: active
                                ? COLORS.platinum
                                : `${COLORS.white}80`,
                            }}
                          >
                            {member.name.split(" ")[0]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {parseFloat(amount) > 0 && members.length > 0 && (
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
                        ${(parseFloat(amount) / members.length).toFixed(2)} each
                      </Text>{" "}
                      across {members.length} members
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
                    <Text className="text-sm font-mono font-semibold text-black">
                      Add Expense
                    </Text>
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
