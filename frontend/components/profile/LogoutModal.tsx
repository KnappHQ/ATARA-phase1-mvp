import { View, Text, Modal, Pressable, TouchableOpacity } from "react-native";
import { MotiView } from "moti";
import { LogOut } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogoutModal = ({ isOpen, onClose }: LogoutModalProps) => {
  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

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
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      >
        <TouchableOpacity activeOpacity={1}>
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
            }}
            className="w-80 rounded-2xl p-6 items-center border border-white/10"
            style={{ backgroundColor: "#0a0a0a" }}
          >
            {/* Icon */}
            <View
              className="w-14 h-14 rounded-full items-center justify-center mb-5"
              style={{ backgroundColor: `${COLORS.accent}15` }}
            >
              <LogOut size={24} color={COLORS.accent} />
            </View>

            <Text className="text-white text-lg font-semibold mb-2">
              Sign Out
            </Text>
            <Text
              className="text-sm text-center mb-6 leading-5"
              style={{ color: `${COLORS.white}50` }}
            >
              Are you sure you want to sign out? You'll need your recovery
              phrase to sign back in.
            </Text>

            <Pressable
              onPress={handleLogout}
              className="w-full h-12 rounded-xl items-center justify-center mb-3"
              style={{ backgroundColor: "#ef4444" }}
            >
              <Text className="text-white font-semibold text-sm">Sign Out</Text>
            </Pressable>

            <Pressable
              onPress={handleCancel}
              className="w-full h-12 rounded-xl items-center justify-center border border-white/10"
              style={{ backgroundColor: `${COLORS.white}05` }}
            >
              <Text
                className="font-semibold text-sm"
                style={{ color: `${COLORS.white}70` }}
              >
                Cancel
              </Text>
            </Pressable>
          </MotiView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
