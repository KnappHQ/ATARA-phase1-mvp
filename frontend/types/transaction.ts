export type TransactionType = "receive" | "send";

export interface UiTransaction {
  id: string;
  name: string;
  amount: string;
  type: TransactionType;
  status: string;

  isExternal: boolean;
  otherPartyAddress: string;

  category: string | null;
  userNote: string | null;

  rawDate: Date;
  date: string;
  time: string;
  value?: string;
}
