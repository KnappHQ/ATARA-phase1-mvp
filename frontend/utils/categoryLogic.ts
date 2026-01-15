import { UiTransaction } from "@/types/transaction";

export const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  transfers: {
    label: "Transfers",
    icon: "users",
    color: "#ffe066",
  },
  income: {
    label: "Income",
    icon: "arrow-down-left",
    color: "#ffe066",
  },
};

export const categorizeTransaction = (tx: UiTransaction): string => {
  if (tx.type === "receive") {
    return "income";
  }
  return "transfers";
};

export const getTransactionCategoryDetails = (tx: UiTransaction) => {
  const categoryKey = categorizeTransaction(tx);
  return CATEGORY_CONFIG[categoryKey];
};
