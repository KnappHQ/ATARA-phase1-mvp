import { useTransactionStore } from "../stores/useTransactionStore";
import { useTransactionHistoryStore } from "../stores/useTransactionHistoryStore";
import { SmartAccountService } from "./smartAccount.service";
import { queueSettlement, retryPendingSettlements, type SettlementReference } from "./settlementRecovery.service";
import { api } from "./api";
import { useAlertStore } from "../stores/useAlertStore";
import * as Sentry from "@sentry/react-native";
import { parseUnits } from "viem";

export interface SendTransactionRequest {
  transactionId?: string;
  recipientAddress: string;
  recipientHandle?: string;
  recipientName?: string;
  amount: string;
  tokenSymbol: string;
  tokenAddress?: string;
  decimals?: number;
  usdValue?: string;
  note?: string;
  forceGasPayment?: boolean;
  /** Called after the transaction is synced to the backend DB. Safe to call backend endpoints that depend on the transaction record existing. */
  settlement?: SettlementReference;
  onSynced?: (transactionId: string) => Promise<void> | void;
}

interface TransactionResponse {
  transactionId: string;
  hash?: string;
  success: boolean;
  error?: string;
  isPaymasterFailure?: boolean;
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
      markTransactionPending,
      updateTransaction,
      markTransactionConfirmed,
      markTransactionFailed,
    } = useTransactionStore.getState();

    const decimals =
      request.decimals || (request.tokenSymbol === "ETH" ? 18 : 6);
    // Never use floating-point arithmetic for on-chain values. A JS number can
    // silently round token amounts and make backend verification fail (or sync
    // a value different from the one shown to the user).
    const rawAmountWei = parseUnits(request.amount, decimals).toString();

    const transactionId =
      request.transactionId ??
      addTransaction({
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
        onSynced: request.onSynced,
      });

    if (request.transactionId) {
      markTransactionPending(transactionId);
      updateTransaction(transactionId, {
        recipientAddress: request.recipientAddress,
        recipientHandle: request.recipientHandle,
        recipientName: request.recipientName,
        amount: request.amount,
        rawAmountWei,
        tokenSymbol: request.tokenSymbol,
        tokenAddress: request.tokenAddress,
        decimals,
        usdValue: request.usdValue,
        note: request.note,
        onSynced: request.onSynced,
      });
    }

    try {
      const network = await api.get("/health/backend");
      const expectedChain = process.env.EXPO_PUBLIC_NETWORK === "base-mainnet" ? 8453 : 84532;
      if (network.data.chainId !== expectedChain) throw new Error("L’app et le service utilisent des réseaux différents. Aucun paiement envoyé.");
      // SmartAccountService.sendTransaction now internally:
      // 1. Sends the UserOperation (gas-sponsored via policy)
      // 2. Waits for it to be bundled into a real transaction
      // 3. Returns the actual mined transaction hash
      const result = request.forceGasPayment
        ? await this.smartAccountService.sendTransactionWithGas({
            recipientAddress: request.recipientAddress,
            amount: request.amount,
            tokenSymbol: request.tokenSymbol,
            tokenAddress: request.tokenAddress,
            decimals: request.decimals,
          })
        : await this.smartAccountService.sendTransaction({
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
      if (result.userOpHash) {
        updateTransaction(transactionId, { userOpHash: result.userOpHash });
      }

      if (request.settlement) {
        try {
          await queueSettlement({ reference: request.settlement, sync: { receiverAddress: request.recipientAddress, txHash: result.hash, amount: request.amount, rawAmountWei, assetSymbol: request.tokenSymbol, userNote: request.note } });
        } catch { useAlertStore.getState().error("Reçu à conserver", "Le paiement est envoyé. La reprise du rapprochement n’a pas pu être enregistrée sur cet appareil."); }
      }
      // Sync with backend in background (don't block the UI)
      this.syncTransactionWithBackend(transactionId)
        .then(async (backendTransactionId) => {
          // Auto-refresh history to show new transaction
          useTransactionHistoryStore.getState().fetchHistory();
          if (request.settlement) await retryPendingSettlements();
          // Notify caller with the backend DB id (not the local UUID)
          // so any follow-up endpoints that look up by id work correctly.
          if (request.onSynced && backendTransactionId) {
            await request.onSynced(backendTransactionId);
          }
        })
        .catch(() => useAlertStore.getState().error("Paiement envoyé, historique à vérifier", "Conserve le reçu et actualise Activity. Ne paie pas une seconde fois pour corriger un délai de synchronisation."));

      return {
        transactionId,
        hash: result.hash,
        success: true,
      };
    } catch (error: any) {
      console.error("Transaction failed:", error);

      const isPaymasterFailure = !!error?.isPaymasterFailure;
      const failureMessage = isPaymasterFailure
        ? "Sponsoring indisponible ou plafond atteint. Réessaie plus tard."
        : error.message;

      markTransactionFailed(transactionId, failureMessage);

      return {
        transactionId,
        success: false,
        error: failureMessage,
        isPaymasterFailure,
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

    const rawAmountWei = transaction.rawAmountWei || parseUnits(transaction.amount, transaction.decimals || 18).toString();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      try {
        const response = await api.post("/transaction/sync", {
          receiverAddress: transaction.recipientAddress, txHash: transaction.hash, userOpHash: transaction.userOpHash,
          amount: transaction.amount, rawAmountWei, assetSymbol: transaction.tokenSymbol,
          category: "transfer", userNote: transaction.note || null,
        });
        if (response.data?.transaction?.id) return response.data.transaction.id as string;
      } catch (error: any) {
        if (![202, 404, 409, 500, 502, 503, 504].includes(error?.response?.status)) throw error;
      }
    }
    throw new Error("Payment confirmed on chain; backend reconciliation pending");
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
