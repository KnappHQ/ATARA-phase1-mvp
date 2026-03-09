import { useTransactionStore } from "../stores/useTransactionStore";
import { useTransactionHistoryStore } from "../stores/useTransactionHistoryStore";
import { SmartAccountService } from "./smartAccount.service";
import { api } from "./api";

export interface SendTransactionRequest {
  recipientAddress: string;
  recipientHandle?: string;
  recipientName?: string;
  amount: string;
  tokenSymbol: string;
  tokenAddress?: string;
  decimals?: number;
  usdValue?: string;
  note?: string;
  /** Called after the transaction is synced to the backend DB. Safe to call backend endpoints that depend on the transaction record existing. */
  onSynced?: (transactionId: string) => Promise<void> | void;
}

export interface TransactionResponse {
  transactionId: string;
  hash?: string;
  success: boolean;
  error?: string;
}

export class TransactionService {
  private smartAccountService: SmartAccountService;

  constructor(smartAccountService: SmartAccountService) {
    this.smartAccountService = smartAccountService;
  }

  async sendTransaction(
    request: SendTransactionRequest,
  ): Promise<TransactionResponse> {
    const {
      addTransaction,
      updateTransaction,
      markTransactionConfirmed,
      markTransactionFailed,
    } = useTransactionStore.getState();

    const decimals =
      request.decimals || (request.tokenSymbol === "ETH" ? 18 : 6);
    const rawAmountWei = (
      parseFloat(request.amount) * Math.pow(10, decimals)
    ).toFixed(0);

    const transactionId = addTransaction({
      recipientAddress: request.recipientAddress,
      recipientHandle: request.recipientHandle,
      recipientName: request.recipientName,
      amount: request.amount,
      rawAmountWei: rawAmountWei,
      tokenSymbol: request.tokenSymbol,
      tokenAddress: request.tokenAddress,
      decimals: decimals,
      usdValue: request.usdValue,
      note: request.note,
    });

    try {
      // SmartAccountService.sendTransaction now internally:
      // 1. Sends the UserOperation (gas-sponsored via policy)
      // 2. Waits for it to be bundled into a real transaction
      // 3. Returns the actual mined transaction hash
      const result = await this.smartAccountService.sendTransaction({
        recipientAddress: request.recipientAddress,
        amount: request.amount,
        tokenSymbol: request.tokenSymbol,
        tokenAddress: request.tokenAddress,
        decimals: request.decimals,
      });

      if (!result.success || !result.hash) {
        throw new Error("Transaction failed to execute");
      }

      // The hash is now a real on-chain tx hash (already mined)
      markTransactionConfirmed(transactionId, result.hash);

      // Sync with backend in background (don't block the UI)
      this.syncTransactionWithBackend(transactionId)
        .then(async (backendTransactionId) => {
          // Auto-refresh history to show new transaction
          useTransactionHistoryStore.getState().fetchHistory();
          // Notify caller with the backend DB id (not the local UUID)
          // so any follow-up endpoints that look up by id work correctly.
          if (request.onSynced && backendTransactionId) {
            await request.onSynced(backendTransactionId);
          }
        })
        .catch((err) =>
          console.error("Backend sync failed (non-blocking):", err),
        );

      return {
        transactionId,
        hash: result.hash,
        success: true,
      };
    } catch (error: any) {
      console.error("Transaction failed:", error);

      markTransactionFailed(transactionId, error.message);

      return {
        transactionId,
        success: false,
        error: error.message,
      };
    }
  }

  private async syncTransactionWithBackend(
    transactionId: string,
  ): Promise<string | null> {
    const { getTransactionById } = useTransactionStore.getState();
    const transaction = getTransactionById(transactionId);

    if (!transaction || !transaction.hash) {
      return null;
    }

    try {
      const rawAmountWei =
        transaction.rawAmountWei ||
        (
          parseFloat(transaction.amount) *
          Math.pow(10, transaction.decimals || 18)
        ).toFixed(0);

      const response = await api.post("/transaction/sync", {
        receiverAddress: transaction.recipientAddress,
        txHash: transaction.hash,
        amount: parseFloat(transaction.amount),
        rawAmountWei: rawAmountWei,
        assetSymbol: transaction.tokenSymbol,
        category: "transfer",
        userNote: transaction.note || null,
      });

      // Return the backend-generated transaction id so callers can reference
      // the DB record directly (e.g. for settlement linking).
      return (response.data?.transaction?.id as string) ?? null;
    } catch (error: any) {
      // 409 = already synced, not a real error
      if (error.response?.status !== 409) {
        console.error("Failed to sync transaction with backend:", error);
      }
      return null;
    }
  }
}

export const useTransactionService = (
  smartAccountService: SmartAccountService | null,
) => {
  if (!smartAccountService) {
    return null;
  }

  return new TransactionService(smartAccountService);
};
