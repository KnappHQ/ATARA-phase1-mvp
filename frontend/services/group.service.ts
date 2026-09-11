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
  assetSymbol: string;
}

export interface SearchUserResult {
  id: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  smartAccountAddress: string;
}

interface GroupExpenseDetailResponse {
  id: string;
  description: string;
  amount: string;
  paidById: string;
  assetSymbol: string;
  splits: { id: string; userId: string; amount: string; decision: "PENDING" | "ACCEPTED" | "DISPUTED"; settled: boolean; user?: { handle: string } }[];
  paidBy: {
    id: string;
    handle: string;
    displayName: string | null;
    profilePicUrl: string | null;
  };
  createdAt: string;
}

export interface GroupDetailResponse {
  assetSymbol: string;
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
    owedByMe: number;
    owedToMe: number;
  }[];
}

export const GroupService = {
  decideSplit: async (expenseId: string, decision: "ACCEPTED" | "DISPUTED") =>
    api.patch(`/groups/e/${expenseId}/decision`, { decision }),
  createSettlementIntent: async (groupId: string, memberId: string): Promise<{ id: string; amount: string; expiresAt: string }> => {
    const response = await api.post(`/groups/${groupId}/settle/${memberId}/quote`);
    return response.data.intent;
  },
  contactBalances: async (address: string): Promise<{ assetSymbol: string; owedByMe: number; owedToMe: number }[]> =>
    (await api.get(`/groups/contacts/${address}/balances`)).data.balances,
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

  addExpense: async (groupId: string, description: string, amount: number, clientRequestId: string,
    customSplits?: { userId: string; amount: string }[]) => {
    const response = await api.post(`/groups/${groupId}/expenses`, {
      description,
      amount, clientRequestId, customSplits,
    });
    return response.data.expense;
  },

  settleByInternalTx: async (
    groupId: string,
    memberId: string,
    transactionId: string, intentId: string,
  ) => {
    const response = await api.post(
      `/groups/${groupId}/settle/${memberId}/by-tx`,
      { transactionId, intentId },
    );
    return response.data;
  },
};
