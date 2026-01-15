import { useAddressBookStore } from "@/stores/useAddressBookStore";
import { UiTransaction } from "@/types/transaction";

export const useTransactionDisplay = (transaction: UiTransaction) => {
  const nickname = useAddressBookStore((state) => {
    if (!transaction.otherPartyAddress) return null;
    return state.contacts[transaction.otherPartyAddress.toLowerCase()] || null;
  });

  let title = transaction.name;

  if (nickname) {
    const prefix = transaction.type === "send" ? "Sent to" : "Received from";
    title = `${prefix} ${nickname}`;
  }

  return {
    title,
    isNickname: !!nickname,
  };
};
