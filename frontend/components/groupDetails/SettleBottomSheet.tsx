import { useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { X, ArrowRight, CheckCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { COLORS } from "@/utils/constants";
import { GroupMemberBalance } from "@/stores/useGroupStore";
import { GroupService } from "@/services/group.service";
import { useAlertStore } from "@/stores/useAlertStore";
import { analyticsEvents } from "@/services/analytics.service";

interface SettleBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  member: GroupMemberBalance | null;
  groupId: string;
  groupName: string;
  /** Called after a successful manual settle so the screen can refresh */
  onSettled: () => void;
}

export const SettleBottomSheet = ({
  isOpen,
  onClose,
  member,
  groupId,
  groupName,
  onSettled,
}: SettleBottomSheetProps) => {
  const router = useRouter();
  const [confirmManual, setConfirmManual] = useState(false);
  const [isMarkingSettled, setIsMarkingSettled] = useState(false);

  if (!member) return null;

  const amount = Math.abs(member.netBalance).toFixed(2);
  const memberDisplayName = member.displayName || `@${member.handle}`;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmManual(false);
    onClose();
  };

  const handleSendAndSettle = () => {
    if (!member.smartAccountAddress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analyticsEvents.groupSettled({ settleType: "on_chain" });
    handleClose();
    router.push({
      pathname: "/send",
      params: {
        contactId: member.userId,
        contactHandle: member.handle,
        contactName: member.displayName || member.handle,
        contactSmartAddress: member.smartAccountAddress,
        prefilledAmount: amount,
        prefilledNote: `Settle: ${groupName}`,
        settlementGroupId: groupId,
        settlementMemberId: member.userId,
      },
    });
  };

  const handleManualSettle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsMarkingSettled(true);
    try {
      await GroupService.markAsSettledManually(groupId, member.userId);
      analyticsEvents.groupSettled({ settleType: "manual" });
      handleClose();
      onSettled();
    } catch (err: any) {
      useAlertStore
        .getState()
        .error(
          "Couldn't mark as settled",
          err.response?.data?.message || "Please try again.",
        );
      handleClose();
    } finally {
      setIsMarkingSettled(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
        onPress={handleClose}
      >
        <MotiView
          from={{ translateY: 80, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: "timing", duration: 300 }}
        >
          {/* Prevent backdrop press from propagating through sheet */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                backgroundColor: "#111111",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: 24,
                paddingTop: 12,
                paddingBottom: 36,
                borderTopWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <View
                className="w-10 h-1 rounded-full self-center mb-6"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              />

              <View className="flex-row items-start justify-between mb-6">
                <View className="flex-1 mr-4">
                  <Text className="text-xl font-semibold text-white">
                    Settle Up
                  </Text>
                  <Text
                    className="text-sm font-mono mt-1"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    You owe{" "}
                    <Text style={{ color: "rgba(255,255,255,0.85)" }}>
                      {memberDisplayName}
                    </Text>{" "}
                    <Text className="text-white font-semibold">${amount}</Text>
                  </Text>
                </View>
                <Pressable
                  onPress={handleClose}
                  className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <X size={16} color={COLORS.white} />
                </Pressable>
              </View>

              {/* Option 1 — Send & Settle */}
              <Pressable
                onPress={handleSendAndSettle}
                disabled={!member.smartAccountAddress}
                className="flex-row items-center gap-4 p-4 rounded-2xl mb-3 active:opacity-80"
                style={{
                  backgroundColor: `${COLORS.accent}15`,
                  borderWidth: 1,
                  borderColor: `${COLORS.accent}30`,
                  opacity: !member.smartAccountAddress ? 0.4 : 1,
                }}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${COLORS.accent}20` }}
                >
                  <ArrowRight size={18} color={COLORS.accent} />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: COLORS.accent }}
                  >
                    Send & Settle
                  </Text>
                  <Text
                    className="text-xs mt-0.5"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Pay ${amount} via app · balance clears automatically
                  </Text>
                </View>
              </Pressable>

              {/* Option 2 — Mark as Settled */}
              {!confirmManual ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setConfirmManual(true);
                  }}
                  className="flex-row items-center gap-4 p-4 rounded-2xl active:opacity-80"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                  >
                    <CheckCircle size={18} color="rgba(255,255,255,0.65)" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-white">
                      Mark as Settled
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Paid in cash or outside the app
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <MotiView
                  from={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "timing", duration: 200 }}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Text
                    className="text-sm mb-4"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                  >
                    Confirm you've already paid{" "}
                    <Text className="text-white font-semibold">
                      {memberDisplayName}
                    </Text>{" "}
                    <Text className="text-white font-semibold">${amount}</Text>{" "}
                    outside the app?
                  </Text>

                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setConfirmManual(false);
                      }}
                      className="flex-1 py-3 rounded-xl items-center active:opacity-70"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                    >
                      <Text
                        className="text-sm font-mono"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleManualSettle}
                      disabled={isMarkingSettled}
                      className="flex-1 py-3 rounded-xl items-center active:opacity-80"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.14)",
                        opacity: isMarkingSettled ? 0.6 : 1,
                      }}
                    >
                      {isMarkingSettled ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text className="text-sm font-mono font-semibold text-white">
                          Yes, Confirm
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </MotiView>
              )}
            </View>
          </Pressable>
        </MotiView>
      </Pressable>
    </Modal>
  );
};
