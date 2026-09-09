import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { MotiView } from "moti";
import { X, Send, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/utils/constants";
import { FeedbackService } from "@/services/feedback.service";
import { useAlertStore } from "@/stores/useAlertStore";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal = ({ isOpen, onClose }: FeedbackModalProps) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const feedbackRef = useRef("");
  const snapPoints = useMemo(() => ["50%"], []);
  const [sheetRenderKey, setSheetRenderKey] = useState(0);

  const [feedback, setFeedback] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setSheetRenderKey((current) => current + 1);
      bottomSheetRef.current?.present();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  const handleSubmit = async () => {
    const currentFeedback = feedbackRef.current.trim();
    if (!currentFeedback || isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsLoading(true);
    try {
      await FeedbackService.submit(currentFeedback);
      setIsSubmitted(true);
      setTimeout(() => {
        setFeedback("");
        feedbackRef.current = "";
        setIsSubmitted(false);
        bottomSheetRef.current?.dismiss();
      }, 2000);
    } catch {
      useAlertStore
        .getState()
        .error(
          "Failed to send feedback",
          "Please try again or contact us at support@atara.finance",
        );
    } finally {
      setIsLoading(false);
    }
  };

  // Triggered by the X button
  const handleCloseButtonPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.dismiss();
  };

  // Single source of truth for cleanup, fires on ANY dismissal.
  const handleDismiss = useCallback(() => {
    setFeedback("");
    feedbackRef.current = "";
    setIsSubmitted(false);
    onClose();
  }, [onClose]);

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
      <BottomSheetView style={{ paddingBottom: 16 }}>
        <View className="flex-row items-center justify-between px-6 pt-3 pb-5">
          <Text className="text-lg font-semibold text-white">
            Beta Feedback
          </Text>
          <Pressable
            onPress={handleCloseButtonPress}
            className="w-9 h-9 rounded-full items-center justify-center border border-white/10"
            style={{ backgroundColor: `${COLORS.white}08` }}
          >
            <X size={16} color={`${COLORS.white}60`} />
          </Pressable>
        </View>

        <View className="px-6">
          {isSubmitted ? (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 280 }}
              className="items-center justify-center py-10"
            >
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: `${COLORS.accent}20` }}
              >
                <Check size={28} color={COLORS.accent} />
              </View>
              <Text className="text-white font-semibold text-base text-center">
                Thank you for building ATARA with us
              </Text>
              <Text className="text-white/50 text-sm mt-2 text-center">
                Your feedback helps shape the future
              </Text>
            </MotiView>
          ) : (
            <View>
              <Text className="text-sm text-white/50 mb-4">
                Share your thoughts, report bugs, or suggest features. Every bit
                of feedback helps us improve.
              </Text>

              <BottomSheetTextInput
                key={sheetRenderKey}
                defaultValue=""
                onChangeText={(text) => {
                  feedbackRef.current = text;
                  setFeedback(text);
                }}
                placeholder="Tell us what's on your mind..."
                placeholderTextColor={`${COLORS.white}30`}
                multiline
                maxLength={500}
                textAlignVertical="top"
                className="rounded-2xl text-sm text-white px-4 py-3"
                style={{
                  minHeight: 120,
                  backgroundColor: `${COLORS.white}05`,
                  borderWidth: 1,
                  borderColor: `${COLORS.white}10`,
                }}
              />

              <View className="flex-row justify-between items-center mt-2 mb-6">
                <Text
                  className="text-xs"
                  style={{ color: `${COLORS.white}30` }}
                >
                  {feedback.length}/500
                </Text>
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={!feedbackRef.current.trim() || isLoading}
                style={{
                  backgroundColor: feedbackRef.current.trim()
                    ? COLORS.accent
                    : `${COLORS.accent}50`,
                  opacity: feedbackRef.current.trim() ? 1 : 0.6,
                  paddingVertical: 14,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.white}
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Send
                    size={16}
                    color={COLORS.white}
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text
                  style={{
                    color: COLORS.white,
                    fontSize: 14,
                    fontWeight: "600",
                    letterSpacing: 0.5,
                  }}
                >
                  {isLoading ? "Sending..." : "Send Feedback"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};
