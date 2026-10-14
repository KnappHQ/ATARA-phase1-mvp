import { api } from "./api";

export interface HistoryTransaction {
  id: string;
  txHash: string;
  timestamp: string;
  status: string;
  amount: string;
  assetSymbol: string;
  category: string | null;
  userNote: string | null;
  /** A note exists but is hidden because the other person was blocked (or blocked you). */
  noteHidden?: boolean;
  type: "send" | "receive";
  isInApp: boolean;
  counterparty: {
    address: string;
    handle: string | null;
    displayName: string | null;
    profilePicUrl: string | null;
  };
}

export const HistoryService = {
  getHistory: async (): Promise<HistoryTransaction[]> => {
    try {
      const response = await api.get("/transaction/history");
      return response.data.history || [];
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to load transaction history",
      );
    }
  },

  updateTransaction: async ({
    transactionId,
    category,
    userNote,
  }: {
    transactionId: string;
    category?: string;
    userNote?: string;
  }): Promise<void> => {
    try {
      await api.patch(`/transaction/${transactionId}`, {
        category,
        userNote,
      });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to update transaction",
      );
    }
  },
};
