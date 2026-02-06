import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal } from "react-native";
import { MotiView } from "moti";
import { X, Pencil } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import * as Haptics from "expo-haptics";

interface NicknameEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  currentNickname?: string;
  onSave: (address: string, nickname: string) => void;
  onRemove: (address: string) => void;
}

export const NicknameEditModal = ({
  isOpen,
  onClose,
  address,
  currentNickname,
  onSave,
  onRemove,
}: NicknameEditModalProps) => {
  const [nickname, setNickname] = useState(currentNickname || "");

  useEffect(() => {
    setNickname(currentNickname || "");
  }, [currentNickname, isOpen]);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (nickname.trim()) {
      onSave(address, nickname.trim());
    } else {
      onRemove(address);
    }
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Abbreviated address display
  const displayAddress =
    address.startsWith("0x") && address.length > 10
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleCancel}
        className="flex-1 bg-black/80 items-center justify-center px-6"
      >
        <TouchableOpacity activeOpacity={1} className="w-full max-w-md">
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: COLORS.black,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <View className="flex-row items-center gap-2">
                <Pencil size={16} color={COLORS.platinum} />
                <Text
                  className="text-xs uppercase text-platinum/80"
                  style={{ letterSpacing: 2 }}
                >
                  Edit Contact
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancel}
                activeOpacity={0.7}
                className="w-7 h-7 rounded-full items-center justify-center border border-platinum/10"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <X size={14} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>
            </View>

            <View className="px-5 pb-5">
              <View
                className="mb-4 p-3 rounded-xl border border-platinum/10"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
              >
                <Text
                  className="text-xs uppercase text-white/50 mb-1"
                  style={{ letterSpacing: 1.5 }}
                >
                  Address
                </Text>
                <Text
                  className="text-sm text-white/80"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {displayAddress}
                </Text>
              </View>

              <View className="mb-5">
                <Text
                  className="text-xs uppercase text-white/50 mb-2"
                  style={{ letterSpacing: 1.5 }}
                >
                  Contact Name (Optional)
                </Text>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="e.g., Marcus"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  className="px-4 py-4 rounded-xl text-sm text-white"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    borderWidth: 1,
                    borderColor: "rgba(245, 245, 240, 0.15)",
                  }}
                  autoFocus
                />
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCancel}
                  activeOpacity={0.7}
                  className="flex-1 py-3 rounded-xl items-center border border-platinum/10"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                >
                  <Text
                    className="text-xs uppercase text-white/70"
                    style={{ letterSpacing: 1 }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  activeOpacity={0.7}
                  className="flex-1 py-3 rounded-xl items-center relative overflow-hidden"
                  style={{
                    backgroundColor: COLORS.platinum,
                    shadowColor: COLORS.platinum,
                    shadowOpacity: 0.2,
                    shadowRadius: 20,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 10,
                  }}
                >
                  <Text
                    className="text-xs uppercase font-semibold"
                    style={{ color: COLORS.black, letterSpacing: 1 }}
                  >
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </MotiView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
