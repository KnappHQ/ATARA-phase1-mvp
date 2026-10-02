import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";

import { COLORS } from "@/utils/constants";

interface ConfirmSheetProps {
  isOpen: boolean;
  title: string;
  /** What will happen, what will not, in plain words. */
  children: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** A statement the person must tick before the button works. */
  acknowledgement?: string;
  /** A word the person must type, such as DELETE. */
  typedConfirmation?: string;
  onCancel: () => void;
  /** May throw: the message is shown and the sheet stays open. */
  onConfirm: () => Promise<void>;
}

/**
 * A confirmation that says what changes. Used for every action that removes
 * something, so each one names what it does NOT remove as well.
 */
export const ConfirmSheet = ({
  isOpen,
  title,
  children,
  confirmLabel,
  destructive = false,
  acknowledgement,
  typedConfirmation,
  onCancel,
  onConfirm,
}: ConfirmSheetProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setBusy(false);
    setError(null);
    setAcknowledged(false);
    setTyped("");
  }, [isOpen]);

  const typedOk = !typedConfirmation || typed.trim().toUpperCase() === typedConfirmation.toUpperCase();
  const ready = (!acknowledgement || acknowledged) && typedOk && !busy;

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    Haptics.impactAsync(destructive ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onConfirm();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This did not complete. Nothing was changed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const accent = destructive ? "#ef4444" : COLORS.accent;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", paddingHorizontal: 20 }}
      >
        <View
          className="max-h-[88%] rounded-3xl border bg-[#0a0a0a] p-6"
          style={{ borderColor: destructive ? "rgba(239,68,68,0.25)" : `${COLORS.white}18` }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text className="text-lg font-semibold text-white">{title}</Text>
            <View className="mt-3">{children}</View>

            {acknowledgement ? (
              <Pressable
                onPress={() => setAcknowledged((value) => !value)}
                disabled={busy}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acknowledged }}
                className="mt-4 flex-row items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <View
                  className="mt-0.5 h-5 w-5 items-center justify-center rounded-[6px] border"
                  style={{
                    borderColor: acknowledged ? COLORS.white : `${COLORS.white}50`,
                    backgroundColor: acknowledged ? COLORS.white : "transparent",
                  }}
                >
                  {acknowledged ? <Check size={13} color={COLORS.black} strokeWidth={3} /> : null}
                </View>
                <Text className="flex-1 text-[12px] leading-5 text-white/75">{acknowledgement}</Text>
              </Pressable>
            ) : null}

            {typedConfirmation ? (
              <View className="mt-4">
                <Text className="text-xs text-white/55">Type {typedConfirmation} to confirm</Text>
                <TextInput
                  accessibilityLabel={`Type ${typedConfirmation} to confirm`}
                  value={typed}
                  onChangeText={setTyped}
                  editable={!busy}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={typedConfirmation}
                  placeholderTextColor={`${COLORS.white}30`}
                  className="mt-2 rounded-2xl border border-white/10 px-4 py-3 text-base text-white"
                  style={{ backgroundColor: `${COLORS.white}05` }}
                />
              </View>
            ) : null}

            {error ? (
              <Text accessibilityRole="alert" className="mt-4 text-xs leading-5 text-red-400">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={confirm}
              disabled={!ready}
              accessibilityRole="button"
              className="mt-5 min-h-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: accent, opacity: ready ? 1 : 0.4 }}
            >
              {busy ? (
                <ActivityIndicator size="small" color={destructive ? COLORS.white : COLORS.black} />
              ) : (
                <Text className="text-sm font-semibold" style={{ color: destructive ? COLORS.white : COLORS.black }}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              className="mt-2 min-h-12 items-center justify-center rounded-2xl border border-white/10"
            >
              <Text className="text-sm font-semibold text-white/70">Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
