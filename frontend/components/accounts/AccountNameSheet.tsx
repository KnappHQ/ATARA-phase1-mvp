import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { COLORS } from "@/utils/constants";
import {
  LABEL_ERROR_TEXT,
  MAX_ACCOUNT_LABEL_LENGTH,
  checkAccountLabel,
} from "@/utils/accountLabels";

interface AccountNameSheetProps {
  isOpen: boolean;
  title: string;
  description: string;
  initialValue: string;
  confirmLabel: string;
  /** Names already used on this iPhone, without the one being edited. */
  taken: readonly string[];
  footnote?: string;
  onCancel: () => void;
  /** May throw: the message is shown under the field and the sheet stays open. */
  onConfirm: (label: string) => Promise<void> | void;
}

/**
 * Asks for the private name of an account on this iPhone. The same sheet names a
 * new account, renames an existing one and names an extra passkey; what it
 * promises about iOS is said by `description` and `footnote`, because it differs.
 */
export const AccountNameSheet = ({
  isOpen,
  title,
  description,
  initialValue,
  confirmLabel,
  taken,
  footnote,
  onCancel,
  onConfirm,
}: AccountNameSheetProps) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setValue(initialValue);
    setError(null);
    setBusy(false);
  }, [initialValue, isOpen]);

  const submit = async () => {
    if (busy) return;
    const check = checkAccountLabel(value, taken);
    if (!check.ok) {
      setError(LABEL_ERROR_TEXT[check.reason]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(check.label);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save this name. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", paddingHorizontal: 24 }}
      >
        <View className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-6">
          <Text className="text-lg font-semibold text-white">{title}</Text>
          <Text className="mt-2 text-sm leading-5 text-white/55">{description}</Text>

          <TextInput
            accessibilityLabel="Account name"
            value={value}
            onChangeText={(text) => {
              setValue(text);
              if (error) setError(null);
            }}
            editable={!busy}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={MAX_ACCOUNT_LABEL_LENGTH}
            returnKeyType="done"
            onSubmitEditing={submit}
            placeholder="For example: Tanguy — Personal"
            placeholderTextColor={`${COLORS.white}30`}
            className="mt-4 rounded-2xl border px-4 py-4 text-base text-white"
            style={{
              backgroundColor: `${COLORS.white}05`,
              borderColor: error ? "#ef4444" : `${COLORS.white}10`,
            }}
          />
          {error ? (
            <Text accessibilityRole="alert" className="mt-2 text-xs text-red-400">
              {error}
            </Text>
          ) : null}
          {footnote ? <Text className="mt-3 text-[11px] leading-4 text-white/40">{footnote}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            className="mt-5 min-h-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: COLORS.accent, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.black} />
            ) : (
              <Text className="text-sm font-semibold text-black">{confirmLabel}</Text>
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
