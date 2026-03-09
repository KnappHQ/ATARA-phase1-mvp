import { create } from "zustand";
import {
  GroupService,
  GroupSummaryResponse,
  GroupDetailResponse,
  SearchUserResult,
} from "@/services/group.service";
import { Contact } from "@/stores/useContactStore";
import { getInitials } from "@/utils/format";

export interface GroupMember {
  id: string;
  name: string;
  handle: string;
  address: string;
  avatar: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  memberCount: number;
  userNetBalance: number;
}

export interface GroupExpenseDetail {
  id: string;
  paidById: string;
  paidByName: string;
  amount: number;
  description: string;
  date: string;
}

export interface GroupMemberBalance {
  userId: string;
  handle: string;
  displayName: string | null;
  smartAccountAddress: string | null;
  netBalance: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  members: GroupMember[];
  expenses: GroupExpenseDetail[];
  memberBalances: GroupMemberBalance[];
}

function mapSummaryToGroup(s: GroupSummaryResponse): Group {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    createdById: s.createdById,
    createdAt: new Date(s.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    memberCount: s.memberCount,
    userNetBalance: s.userNetBalance,
  };
}

export function mapContactToMember(c: Contact): GroupMember {
  return {
    id: c.id,
    name: `@${c.handle}`,
    handle: c.handle,
    address: c.smartAccountAddress,
    avatar: getInitials(c.name || null, c.handle),
  };
}

export function mapSearchUserToMember(u: SearchUserResult): GroupMember {
  return {
    id: u.id,
    name: `@${u.handle}`,
    handle: u.handle,
    address: u.smartAccountAddress,
    avatar: getInitials(u.displayName, u.handle),
  };
}

function mapDetailResponse(d: GroupDetailResponse): GroupDetail {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    createdById: d.createdById,
    createdAt: new Date(d.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    members: d.members.map((m) => ({
      id: m.user.id,
      name: m.user.displayName || `@${m.user.handle}`,
      handle: m.user.handle,
      address: "",
      avatar: getInitials(m.user.displayName, m.user.handle),
    })),
    expenses: d.expenses.map((e) => ({
      id: e.id,
      paidById: e.paidById,
      paidByName: e.paidBy.displayName || `@${e.paidBy.handle}`,
      amount: parseFloat(e.amount),
      description: e.description,
      date: new Date(e.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    })),
    memberBalances: d.memberBalances.map((b) => ({
      userId: b.userId,
      handle: b.handle,
      displayName: b.displayName,
      smartAccountAddress: b.smartAccountAddress ?? null,
      netBalance: b.netBalance,
    })),
  };
}

interface GroupState {
  groups: Group[];
  isLoading: boolean;
  error: string | null;

  groupDetail: GroupDetail | null;
  isLoadingDetail: boolean;
  detailError: string | null;

  fetchGroups: () => Promise<void>;
  createGroup: (
    name: string,
    memberHandles: string[],
    description?: string,
  ) => Promise<void>;
  fetchGroupDetail: (id: string) => Promise<void>;
  addExpense: (
    groupId: string,
    description: string,
    amount: number,
  ) => Promise<void>;
  clearDetail: () => void;
  clearError: () => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  isLoading: false,
  error: null,

  groupDetail: null,
  isLoadingDetail: false,
  detailError: null,

  fetchGroups: async () => {
    const { isLoading } = get();
    if (isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const data = await GroupService.getMyGroups();
      set({ groups: data.map(mapSummaryToGroup) });
    } catch (err: any) {
      console.error("Failed to fetch groups:", err);
      set({ error: err.response?.data?.message || "Failed to load groups" });
    } finally {
      set({ isLoading: false });
    }
  },

  createGroup: async (name, memberHandles, description) => {
    await GroupService.createGroup(name, memberHandles, description);
    await get().fetchGroups();
  },

  fetchGroupDetail: async (id) => {
    set({ isLoadingDetail: true, detailError: null });
    try {
      const data = await GroupService.getGroupDetails(id);
      set({ groupDetail: mapDetailResponse(data) });
    } catch (err: any) {
      set({
        detailError:
          err.response?.data?.message || "Failed to load group details",
      });
    } finally {
      set({ isLoadingDetail: false });
    }
  },

  addExpense: async (groupId, description, amount) => {
    await GroupService.addExpense(groupId, description, amount);
    await get().fetchGroupDetail(groupId);
  },

  clearDetail: () => set({ groupDetail: null, detailError: null }),

  clearError: () => set({ error: null }),
}));
