import { useTransactionStore } from "../stores/useTransactionStore";
import { useTransactionHistoryStore } from "../stores/useTransactionHistoryStore";
import { SmartAccountService } from "./smartAccount.service";
import { flushRecordings, getPaymentOperations } from "./paymentOperations.runtime";
import { queueSettlement, retryPendingSettlements, type SettlementReference } from "./settlementRecovery.service";
import { api } from "./api";
import { useAlertStore } from "../stores/useAlertStore";
import * as Sentry from "@sentry/react-native";
import { parseUnits } from "viem";
import { assessServiceNetwork } from "../utils/networkGuard";

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
  /** Submitted, but neither confirmed nor refused. Never send it again blindly. */
  isPendingVerification?: boolean;
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
      const expectedChain = process.env.EXPO_PUBLIC_NETWORK === "base-mainnet" ? 8453 : 84532;
      let reportedChain: unknown;
      try {
        const network = await api.get("/health/backend", { timeout: 4000 });
        reportedChain = network.data?.chainId;
      } catch {
        // Unreachable is not a reason to refuse: see assessServiceNetwork.
        reportedChain = undefined;
      }
      if (assessServiceNetwork(reportedChain, expectedChain) === "mismatch") {
        throw new Error("The app and service use different networks. No payment was sent.");
      }
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
      if (result.userOpHash) {
        updateTransaction(transactionId, { userOpHash: result.userOpHash });
      }

      if (request.settlement) {
        try {
          await queueSettlement({ reference: request.settlement, sync: { receiverAddress: request.recipientAddress, txHash: result.hash, amount: request.amount, rawAmountWei, assetSymbol: request.tokenSymbol, userNote: request.note } });
        } catch { useAlertStore.getState().error("Keep your receipt", "Payment sent. This device could not save the payment reconciliation record."); }
      }
      // Sync with backend in background (don't block the UI)
      this.recordConfirmedPayment(transactionId, result.hash, request)
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
        .catch(() => useAlertStore.getState().error("Payment sent", "It went through. ATARA has not recorded it in your history yet and will keep trying; Activity shows where it stands. Do not pay a second time."));

      return {
        transactionId,
        hash: result.hash,
        success: true,
      };
    } catch (error: any) {
      console.error("Transaction failed:", error);

      const isPaymasterFailure = !!error?.isPaymasterFailure;
      const failureMessage = isPaymasterFailure
        ? "Gas sponsorship is unavailable or its limit has been reached. Try again later."
        : error.message;

      if (error?.isPendingVerification) {
        updateTransaction(transactionId, { error: "Awaiting chain verification. Check Activity before sending again." });
      } else {
        markTransactionFailed(transactionId, failureMessage);
      }

      return {
        transactionId,
        success: false,
        error: failureMessage,
        isPaymasterFailure,
        isPendingVerification: !!error?.isPendingVerification,
      };
    }
  }

  /**
   * Tells ATARA's service about a payment that is already confirmed on the chain.
   *
   * The confirmed payment is on this phone's outbox (see paymentOperations)
   * before this runs, so if the service is down, or the app closes, it is
   * retried later and only the recording is retried: the transfer is never
   * sent again. Resolves with the service's id for it, or null when it was
   * already recorded.
   */
  private async recordConfirmedPayment(
    transactionId: string,
    hash: string,
    request: SendTransactionRequest,
  ): Promise<string | null> {
    const account = this.smartAccountService.address;
    const operations = getPaymentOperations();
    const wanted = hash.toLowerCase();
    const transaction = useTransactionStore.getState().getTransactionById(transactionId);
    await operations.outbox.enrich(account, wanted, {
      amount: request.amount,
      category: "transfer",
      note: request.note ?? transaction?.note ?? null,
      ...(request.recipientHandle !== undefined ? { recipientHandle: request.recipientHandle } : {}),
      ...(request.recipientName !== undefined ? { recipientName: request.recipientName } : {}),
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      const summary = await flushRecordings(account, { force: true });
      const id = summary.recordedIds[wanted];
      if (id) return id;
      const remaining = (await operations.outbox.list(account)).find((entry) => entry.transactionHash === wanted);
      if (!remaining) return null;
      if (remaining.state === "rejected") break;
    }
    throw new Error("Payment confirmed on chain; recording pending");
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
