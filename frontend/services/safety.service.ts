import { api } from "./api";
import type { ReportReason } from "@/utils/safetyFlow";

export interface BlockedUser {
  handle: string;
  displayName: string | null;
  blockedAt: string;
}

export interface GroupInvitation {
  groupId: string;
  groupName: string;
  description: string | null;
  invitedAt: string;
  invitedBy: { handle: string; displayName: string | null } | null;
}

export const SafetyService = {
  block: async (handle: string): Promise<void> => {
    await api.post("/safety/blocks", { handle: handle.replace(/^@/, "") });
  },
  unblock: async (handle: string): Promise<void> => {
    await api.delete(`/safety/blocks/${encodeURIComponent(handle.replace(/^@/, ""))}`);
  },
  listBlocks: async (): Promise<BlockedUser[]> => {
    const response = await api.get("/safety/blocks");
    return Array.isArray(response.data?.blocks) ? response.data.blocks : [];
  },
  report: async (payload: {
    handle: string;
    reason: ReportReason | null;
    details: string;
    alsoBlock: boolean;
    context: string;
    contextId?: string;
  }): Promise<void> => {
    await api.post("/safety/reports", payload);
  },

  // Someone who adds you to a group needs your yes first.
  getInvitations: async (): Promise<GroupInvitation[]> => {
    const response = await api.get("/groups/invitations");
    return Array.isArray(response.data?.invitations) ? response.data.invitations : [];
  },
  acceptInvitation: async (groupId: string): Promise<void> => {
    await api.post(`/groups/${encodeURIComponent(groupId)}/invitation/accept`);
  },
  declineInvitation: async (groupId: string): Promise<void> => {
    await api.delete(`/groups/${encodeURIComponent(groupId)}/invitation`);
  },
};
