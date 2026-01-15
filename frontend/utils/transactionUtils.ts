import { UiTransaction } from "@/types/transaction";

export const resolveTransactionName = (
  tx: UiTransaction,
  contacts: Record<string, string>
): string => {
  if (!tx.otherPartyAddress) return tx.name;

  const nickname = contacts[tx.otherPartyAddress.toLowerCase()];

  if (nickname) {
    const prefix = tx.type === "send" ? "Sent to" : "Received from";
    return `${prefix} ${nickname}`;
  }

  return tx.name;
};
