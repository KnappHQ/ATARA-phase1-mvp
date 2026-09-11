import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MotiView } from "moti";
import { Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteAccountModal = ({
  isOpen,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isDeleting) return;
    setError(null);
    onClose();
  };

  const deleteAccount = async () => {
    setIsDeleting(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await onConfirm();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Unable to delete your account.",
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={close}
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: "rgba(0,0,0,0.82)" }}
      >
        <TouchableOpacity activeOpacity={1} className="w-full max-w-[360px]">
          <MotiView
            from={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="rounded-3xl border border-red-500/20 bg-[#0a0a0a] p-6 items-center"
          >
            <View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
              <Trash2 size={24} color="#ef4444" />
            </View>

            <Text className="mb-2 text-lg font-semibold text-white">
              Delete Account
            </Text>
            <Text className="mb-5 text-center text-sm leading-5 text-white/55">
              This removes your profile and ends your sessions. Shared expenses,
              debts and payment receipts remain under a deleted-account label
              for the other members. Blockchain records cannot be erased.
            </Text>

            {error ? (
              <Text className="mb-4 text-center text-xs text-red-400">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={deleteAccount}
              disabled={isDeleting}
              className="mb-3 h-12 w-full items-center justify-center rounded-xl bg-red-500"
              style={{ opacity: isDeleting ? 0.65 : 1 }}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-sm font-semibold text-white">
                  Delete Permanently
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={close}
              disabled={isDeleting}
              className="h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5"
            >
              <Text className="text-sm font-semibold text-white/70">
                Cancel
              </Text>
            </Pressable>
          </MotiView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
