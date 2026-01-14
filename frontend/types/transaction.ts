export type TransactionType = "receive" | "send";

export interface UiTransaction {
  id: string;
  name: string;
  amount: string;
  type: TransactionType;
  status: string;
  

  rawDate: Date; 
  
 
  date: string;   
  time: string;   
  value?: string | null; 
}