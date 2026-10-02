import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { alchemyWalletTransport } from "@alchemy/wallet-apis";
import { createClient, createPublicClient, fallback, http } from "viem";
import { getCallsStatus } from "viem/actions";
import { base, baseSepolia } from "viem/chains";

import { api } from "./api";
import { createProviderStatusSource } from "./providerStatus";
import { createChainReader, type ChainClientLike } from "./userOperationChain";
import { createPaymentOperations, type PaymentOperations } from "./paymentOperations";
import { useAuthStore } from "@/stores/useAuthStore";
import { APP_NETWORK, CHAIN_ID } from "@/utils/constants";
import { DEFAULT_ASSETS } from "@/utils/constants";
import { runExclusiveOperation } from "@/utils/exclusiveOperation";
import { interpretRecordingResponse, type OutboxEntry, type RecordingOutcome } from "@/utils/operationOutbox";

/**
 * The payment-verification machinery wired to this phone: its storage, Alchemy's
 * wallet API and Base's nodes for reading, and Sentry for monitoring.
 *
 * Nothing here needs the wallet to be initialised. Checking a payment asks two
 * read-only questions (Alchemy: what is the status of this call id; Base: did
 * the EntryPoint execute this user operation hash), and neither takes a signer.
 * The old check ran through the signing client, so a wallet that had not
 * finished starting (or an account that was not the signed-in one) made
 * verification "unavailable" even though nothing about the payment was unknown.
 */

const chain = APP_NETWORK === "base-mainnet" ? base : baseSepolia;

const alchemyKey = (): string =>
  (
    process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ||
    (Constants.expoConfig?.extra?.EXPO_PUBLIC_ALCHEMY_API_KEY as string | undefined) ||
    ""
  ).trim();

const PUBLIC_RPC =
  process.env.EXPO_PUBLIC_CHAIN_RPC_URL?.trim() ||
  (APP_NETWORK === "base-mainnet" ? "https://mainnet.base.org" : "https://sepolia.base.org");

const providerSource = () => {
  const apiKey = alchemyKey();
  if (!apiKey) return null;
  return createProviderStatusSource({
    chain,
    transport: alchemyWalletTransport({ apiKey }),
    createClient,
    getCallsStatus,
  });
};

const chainReader = () => {
  const apiKey = alchemyKey();
  const alchemyRpc = apiKey
    ? `https://${APP_NETWORK === "base-mainnet" ? "base-mainnet" : "base-sepolia"}.g.alchemy.com/v2/${apiKey}`
    : null;
  const client = createPublicClient({
    chain,
    // Alchemy first (wide log searches), Base's own node if it fails.
    transport: fallback([...(alchemyRpc ? [http(alchemyRpc, { timeout: 10_000, retryCount: 1 })] : []), http(PUBLIC_RPC, { timeout: 10_000, retryCount: 1 })]),
  });
  return createChainReader({ client: client as unknown as ChainClientLike });
};

/** Only a kind and a code ever leave the phone: no addresses, ids, amounts or messages. */
const report = (event: string, facts: Record<string, string | number | boolean> = {}) => {
  try {
    Sentry.captureMessage(`payment-verification: ${event}`, { level: "warning", extra: facts });
  } catch {
    // Monitoring must never break a payment.
  }
};

const symbolForToken = (token: string): string | undefined =>
  DEFAULT_ASSETS.find((asset) => asset.contractAddress?.toLowerCase() === token.toLowerCase())?.symbol;

let instance: PaymentOperations | null = null;

export const getPaymentOperations = (): PaymentOperations => {
  if (!instance) {
    instance = createPaymentOperations({
      storage: {
        getItem: (key) => AsyncStorage.getItem(key),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        removeItem: (key) => AsyncStorage.removeItem(key),
        getAllKeys: async () => [...(await AsyncStorage.getAllKeys())],
      },
      chainId: CHAIN_ID,
      provider: providerSource(),
      chain: chainReader(),
      symbolForToken,
      currentUserId: () => useAuthStore.getState().user?.id ?? null,
      report,
      lock: runExclusiveOperation,
    });
  }
  return instance;
};

/** Records one confirmed transfer with ATARA's service. Idempotent per transaction hash on the service side. */
export const postRecording = async (entry: OutboxEntry): Promise<RecordingOutcome> => {
  const session = useAuthStore.getState();
  if (!session.isAuthenticated || (entry.userId && session.user?.id !== entry.userId)) {
    // Recorded under the account that made the payment, when that account is signed in.
    return interpretRecordingResponse(null, false);
  }
  if (!entry.assetSymbol) {
    // The service records by asset symbol; a token this app does not list cannot be matched.
    return { kind: "rejected", status: 400, reason: "The service cannot match this transfer automatically." };
  }
  try {
    // The service reads the amount from the chain itself; what is sent is only to find the transfer.
    const response = await api.post("/transaction/sync", {
      receiverAddress: entry.receiverAddress,
      txHash: entry.transactionHash,
      ...(entry.amount ? { amount: entry.amount } : {}),
      ...(entry.rawAmountWei ? { rawAmountWei: entry.rawAmountWei } : {}),
      assetSymbol: entry.assetSymbol,
      category: entry.category ?? "transfer",
      userNote: entry.note ?? null,
    });
    const id = response.data?.transaction?.id;
    if (typeof id === "string" && id) return { kind: "recorded", backendTransactionId: id };
    return { kind: "retry", status: response.status, reason: "The service did not return the recorded payment." };
  } catch (error: any) {
    const status = typeof error?.response?.status === "number" ? error.response.status : undefined;
    const message = typeof error?.response?.data?.error === "string" ? error.response.data.error : error?.response?.data?.message;
    return status === undefined
      ? interpretRecordingResponse(null)
      : interpretRecordingResponse({ status, message: typeof message === "string" ? message : undefined });
  }
};

/** Tries every queued recording of one account. Never sends money. */
export const flushRecordings = async (account: string, options: { force?: boolean } = {}) =>
  getPaymentOperations().outbox.flush(account, postRecording, options);
