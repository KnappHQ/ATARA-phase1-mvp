import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";

interface DisplayNameModalProps {
  isOpen: boolean;
  displayName: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (displayName: string) => Promise<void>;
}

export const DisplayNameModal = ({
  isOpen,
  displayName,
  isSaving,
  onClose,
  onSave,
}: DisplayNameModalProps) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const draftRef = useRef(displayName);
  const snapPoints = useMemo(() => ["38%"], []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    draftRef.current = displayName;
    setError(null);

    const frameId = requestAnimationFrame(() => {
      bottomSheetRef.current?.present();
    });

    return () => cancelAnimationFrame(frameId);
  }, [displayName, isOpen]);

  const handleDismiss = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.dismiss();
  };

  const handleSave = async () => {
    const trimmed = draftRef.current.trim();
    if (!trimmed) {
      setError("Display name cannot be empty.");
      return;
    }

    setError(null);
    try {
      await onSave(trimmed);
      bottomSheetRef.current?.dismiss();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? "Failed to update display name.",
      );
    }
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.8}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      onDismiss={handleDismiss}
      snapPoints={snapPoints}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustPan"
      bottomInset={8}
      enablePanDownToClose
      enableDismissOnClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: "#0a0a0a",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: `${COLORS.white}18`,
      }}
      handleIndicatorStyle={{
        backgroundColor: `${COLORS.white}20`,
        width: 40,
        height: 4,
      }}
    >
      <BottomSheetView style={{ paddingBottom: 20 }}>
        <View className="flex-row items-center justify-between px-6 pt-3 pb-5">
          <Text className="text-lg font-semibold text-white">
            Edit Display Name
          </Text>
          <Pressable
            onPress={handleClose}
            className="w-9 h-9 rounded-full items-center justify-center border border-white/10"
            style={{ backgroundColor: `${COLORS.white}08` }}
          >
            <X size={16} color={`${COLORS.white}60`} />
          </Pressable>
        </View>

        <View className="px-6">
          <Text className="text-sm text-white/50 mb-4">
            Choose the name shown on your profile.
          </Text>

          <BottomSheetTextInput
            defaultValue={displayName}
            onChangeText={(text) => {
              draftRef.current = text;
              if (error) {
                setError(null);
              }
            }}
            placeholder="Your display name"
            placeholderTextColor={`${COLORS.white}30`}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={40}
            returnKeyType="done"
            className="rounded-2xl text-base text-white px-4 py-4"
            style={{
              backgroundColor: `${COLORS.white}05`,
              borderWidth: 1,
              borderColor: error ? "#ef4444" : `${COLORS.white}10`,
            }}
          />

          {error ? (
            <Text className="text-xs mt-3" style={{ color: "#ef4444" }}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className="py-4 rounded-2xl items-center justify-center mt-4"
            style={{
              backgroundColor: isSaving ? `${COLORS.accent}40` : COLORS.accent,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text className="text-sm font-semibold text-white tracking-wide">
                Save
              </Text>
            )}
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};
