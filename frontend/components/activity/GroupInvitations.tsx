import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafetyService, type GroupInvitation } from "@/services/safety.service";
import { useAlertStore } from "@/stores/useAlertStore";
import { useGroupStore } from "@/stores/useGroupStore";
import { COLORS } from "@/utils/constants";
import { safetyFailureText } from "@/utils/safetyFlow";

/**
 * Groups other people added you to. Nothing is assigned to you, and you see none
 * of the group, until you accept. You can also decline, or decline and block the
 * person who added you.
 */
export const GroupInvitations = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvitations(await SafetyService.getInvitations());
    } catch {
      // Without the list there is simply nothing to answer: never an error on the Groups tab.
      setInvitations([]);
    }
  }, []);

  // Loads on mount, and again whenever the screen is pulled down to refresh.
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const act = async (invitation: GroupInvitation, action: "accept" | "decline" | "block") => {
    if (busyId) return;
    setBusyId(invitation.groupId);
    try {
      if (action === "accept") {
        await SafetyService.acceptInvitation(invitation.groupId);
        await useGroupStore.getState().fetchGroups();
      } else if (action === "decline") {
        await SafetyService.declineInvitation(invitation.groupId);
      } else if (invitation.invitedBy) {
        // Blocking the person who invited you also ends the invitation, on the service.
        await SafetyService.block(invitation.invitedBy.handle);
      }
      await load();
    } catch (error) {
      useAlertStore.getState().error("Could not update the invitation", safetyFailureText(error));
    } finally {
      setBusyId(null);
    }
  };

  if (invitations.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: `${COLORS.white}66` }}>
        Invitations
      </Text>
      {invitations.map((invitation) => {
        const by = invitation.invitedBy ? `@${invitation.invitedBy.handle}` : "Someone";
        const busy = busyId === invitation.groupId;
        return (
          <View
            key={invitation.groupId}
            className="rounded-2xl p-4 mb-3"
            style={{ backgroundColor: `${COLORS.white}08`, borderWidth: 1, borderColor: `${COLORS.white}20`, opacity: busy ? 0.6 : 1 }}
          >
            <Text className="text-white font-semibold">{invitation.groupName}</Text>
            <Text className="text-white/60 text-sm mt-1">
              {by} added you to this group. Nothing is shared with you until you accept.
            </Text>
            <View className="flex-row gap-3 mt-3">
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => act(invitation, "accept")}
                className="flex-1 items-center rounded-xl py-2.5"
                style={{ backgroundColor: COLORS.white }}
              >
                {busy ? <ActivityIndicator color={COLORS.black} /> : <Text className="font-semibold" style={{ color: COLORS.black }}>Accept</Text>}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => act(invitation, "decline")}
                className="flex-1 items-center rounded-xl py-2.5"
                style={{ borderWidth: 1, borderColor: `${COLORS.white}30` }}
              >
                <Text className="font-semibold text-white">Decline</Text>
              </Pressable>
            </View>
            {invitation.invitedBy ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => act(invitation, "block")} className="mt-3 self-start">
                <Text className="text-sm" style={{ color: "#fca5a5" }}>Decline and block {by}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};
