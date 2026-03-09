import { api } from "./api";

export interface GroupSummaryResponse {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  userNetBalance: number;
}

export interface SearchUserResult {
  id: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  smartAccountAddress: string;
}

export interface GroupExpenseDetailResponse {
  id: string;
  description: string;
  amount: string;
  paidById: string;
  paidBy: {
    id: string;
    handle: string;
    displayName: string | null;
    profilePicUrl: string | null;
  };
  createdAt: string;
}

export interface GroupDetailResponse {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  members: {
    userId: string;
    user: {
      id: string;
      handle: string;
      displayName: string | null;
      profilePicUrl: string | null;
    };
  }[];
  expenses: GroupExpenseDetailResponse[];
  memberBalances: {
    userId: string;
    handle: string;
    displayName: string | null;
    profilePicUrl: string | null;
    smartAccountAddress: string | null;
    netBalance: number;
  }[];
}

export const GroupService = {
  getMyGroups: async (): Promise<GroupSummaryResponse[]> => {
    const response = await api.get("/groups");
    return response.data.groups;
  },

  createGroup: async (
    name: string,
    memberHandles: string[],
    description?: string,
  ) => {
    const response = await api.post("/groups", {
      name,
      description,
      memberHandles,
    });
    return response.data.group;
  },

  searchUsers: async (query: string): Promise<SearchUserResult[]> => {
    const response = await api.get("/user/search", {
      params: { q: query },
    });
    return response.data.users;
  },

  getGroupDetails: async (groupId: string): Promise<GroupDetailResponse> => {
    const response = await api.get(`/groups/${groupId}`);
    return response.data.group;
  },

  addExpense: async (groupId: string, description: string, amount: number) => {
    const response = await api.post(`/groups/${groupId}/expenses`, {
      description,
      amount,
    });
    return response.data.expense;
  },

  markAsSettledManually: async (groupId: string, memberId: string) => {
    const response = await api.post(
      `/groups/${groupId}/settle/${memberId}/manual`,
    );
    return response.data;
  },

  settleByInternalTx: async (
    groupId: string,
    memberId: string,
    transactionId: string,
  ) => {
    const response = await api.post(
      `/groups/${groupId}/settle/${memberId}/by-tx`,
      { transactionId },
    );
    return response.data;
  },
};
