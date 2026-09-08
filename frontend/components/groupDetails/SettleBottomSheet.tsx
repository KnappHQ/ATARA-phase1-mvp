import { View, Text, Pressable, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { X, ArrowRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { COLORS } from "@/utils/constants";
import { GroupMemberBalance } from "@/stores/useGroupStore";
import { useState } from "react";
import { GroupService } from "@/services/group.service";
import { useAlertStore } from "@/stores/useAlertStore";

interface SettleBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  member: GroupMemberBalance | null;
  groupId: string;
  groupName: string;
}

export const SettleBottomSheet = ({
  isOpen,
  onClose,
  member,
  groupId,
  groupName,
}: SettleBottomSheetProps) => {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  if (!member) return null;

  const amount = (member.owedByMe ?? 0).toFixed(2);
  const memberDisplayName = member.displayName || `@${member.handle}`;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSendAndSettle = async () => {
    if (!member.smartAccountAddress || busy) return;
    setBusy(true);
    try {
      const quote = await GroupService.createSettlementIntent(groupId, member.userId);
      handleClose();
      router.push({ pathname: "/send", params: {
        contactId: member.userId, contactHandle: member.handle,
        contactName: member.displayName || member.handle, contactSmartAddress: member.smartAccountAddress,
        prefilledAmount: String(quote.amount), prefilledAsset: "USDC", prefilledNote: `Remboursement : ${groupName}`,
        settlementGroupId: groupId, settlementMemberId: member.userId, settlementIntentId: quote.id,
        settlementExpiresAt: quote.expiresAt,
      } });
    } catch (error: any) { useAlertStore.getState().error("Règlement indisponible", error?.response?.data?.message ?? "Réessaie dans un instant."); }
    finally { setBusy(false); }
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
                    <Text className="text-white font-semibold">{amount} USDC</Text>
              </Text>
              <Text className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.55)" }}>
                Les parts acceptées seront vérifiées avant le paiement. Les montants dus dans l’autre sens restent affichés séparément.
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
                disabled={!member.smartAccountAddress || busy}
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
                    Vérifier le montant et confirmer le paiement
                  </Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </MotiView>
      </Pressable>
    </Modal>
  );
};
