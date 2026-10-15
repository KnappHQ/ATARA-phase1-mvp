import { useEffect, useState } from "react";
import {
  parseEther,
  parseUnits,
  encodeFunctionData,
  toHex,
} from "viem";
import { toAccount } from "viem/accounts";
import type { LocalAccount } from "viem";
import * as Sentry from "@sentry/react-native";
import { useEmbeddedEthereumWallet } from "@privy-io/expo";
import { runExclusiveOperation } from "@/utils/exclusiveOperation";
import { base, baseSepolia } from "viem/chains";
import {
  alchemyWalletTransport,
  createSmartWalletClient,
} from "@alchemy/wallet-apis";
import Constants from "expo-constants";
import type {
  SignableMessage,
  TransactionSerializable,
} from "viem";

import { APP_NETWORK, CHAIN_ID } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAddressVerificationStore } from "@/stores/useAddressVerificationStore";
import { getPaymentOperations } from "@/services/paymentOperations.runtime";
import type { OperationReport } from "@/services/paymentOperations";
import { submitAndConfirm } from "@/services/paymentSubmission";
import {
  compareDerivedAddress,
  type AddressVerification,
} from "@/utils/addressVerification";
import { useExternalWallet } from "@/providers/ExternalWalletProvider";
import { getTokenAddress } from "@/utils/tokenConfig";
import {
  FEE_MESSAGES,
  checkPreparedFee,
  classifyFeeFailure,
  createFeeError,
  isFeeError,
  usableFee,
  type FeeGuard,
} from "@/utils/networkFee";

// ERC-20 ABI for transfer function
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export interface SendTransactionParams {
  recipientAddress: string;
  amount: string;
  tokenSymbol: string;
  tokenAddress?: string;
  decimals?: number;
}

export interface TransactionResult {
  hash: string; // This is the actual mined transaction hash
  userOpHash?: string;
  success: boolean;
}

export interface SmartAccountCall {
  target: `0x${string}`;
  value?: bigint;
  data: `0x${string}` | string;
}

export type { FeeGuard };

export interface SendOptions {
  /** The provider has accepted the payment and it is on record: it can no longer be sent twice. */
  onSubmitted?: () => void;
  /** Checked against the real fee before anything is signed. */
  feeGuard?: FeeGuard;
}

export interface SendTransactionFailure extends Error {
  code?: string;
  cause?: unknown;
  isPendingVerification?: boolean;
  notSent?: boolean;
}

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Transaction failed";
};

const createTransactionError = (
  message: string,
  options?: { cause?: unknown },
): SendTransactionFailure => {
  const cause = options?.cause;
  // A fee problem already carries its own plain message and code: keep it whole.
  if (isFeeError(cause)) return cause;
  const feeCode = classifyFeeFailure(message);
  const error = new Error(feeCode ? FEE_MESSAGES[feeCode] : message) as SendTransactionFailure;
  error.name = "SendTransactionError";
  error.cause = cause;
  error.code = feeCode ?? undefined;
  error.isPendingVerification = !!(cause as SendTransactionFailure)?.isPendingVerification;
  return error;
};

export type EthereumSignerWallet = {
  address: string;
  getProvider: () => Promise<{
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  }>;
};

const getAlchemyWalletConfig = () => {
  // Trimmed, because a value that is only whitespace passes a plain truthiness
  // check and then reaches Alchemy as an empty bearer token, which comes back
  // as "Must be authenticated!" rather than as the missing-key error.
  const alchemyApiKey = (
    process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ||
    (Constants.expoConfig?.extra?.EXPO_PUBLIC_ALCHEMY_API_KEY as
      | string
      | undefined) ||
    ""
  ).trim();
  const alchemyFeePolicyId = (
    process.env.EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID ||
    (Constants.expoConfig?.extra?.EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID as
      | string
      | undefined) ||
    ""
  ).trim();

  return { alchemyApiKey, alchemyFeePolicyId };
};

const createOwnerSigner = async (wallet: EthereumSignerWallet) => {
  const provider = await wallet.getProvider();
  const walletAddress = wallet.address as `0x${string}`;
  const bigintReplacer = (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value;

  return toAccount({
    address: walletAddress,
    async signMessage({ message }: { message: SignableMessage }) {
      const rawMessage =
        typeof message === "object" && message !== null && "raw" in message
          ? (message as { raw: `0x${string}` | Uint8Array }).raw
          : message;
      const signableMessage =
        typeof rawMessage === "string" && rawMessage.startsWith("0x")
          ? rawMessage
          : toHex(rawMessage as Exclude<typeof rawMessage, string> | string);

      return provider.request({
        method: "personal_sign",
        params: [signableMessage, walletAddress],
      }) as Promise<`0x${string}`>;
    },
    async signTransaction(transaction: TransactionSerializable) {
      return provider.request({
        method: "eth_signTransaction",
        params: [transaction as any],
      }) as Promise<`0x${string}`>;
    },
    async signTypedData(typedData: unknown) {
      return provider.request({
        method: "eth_signTypedData_v4",
        params: [walletAddress, JSON.stringify(typedData, bigintReplacer)],
      }) as Promise<`0x${string}`>;
    },
  }) as LocalAccount;
};

export const createAlchemySmartAccountService = async ({
  wallet,
  smartAccountAddress,
}: {
  wallet: EthereumSignerWallet;
  smartAccountAddress?: string | null;
}): Promise<SmartAccountService> => {
  const { alchemyApiKey, alchemyFeePolicyId } = getAlchemyWalletConfig();

  if (!alchemyApiKey) {
    throw new Error("Missing EXPO_PUBLIC_ALCHEMY_API_KEY");
  }

  const chain = APP_NETWORK === "base-mainnet" ? base : baseSepolia;
  const signer = await createOwnerSigner(wallet);
  const requestClient = createSmartWalletClient({
    signer,
    transport: alchemyWalletTransport({ apiKey: alchemyApiKey }),
    chain,
  });

  const account = smartAccountAddress
    ? await requestClient.requestAccount({
        accountAddress: smartAccountAddress as `0x${string}`,
      })
    : await requestClient.requestAccount({
        creationHint: { accountType: "sma-b" },
      });

  const client = createSmartWalletClient({
    signer,
    transport: alchemyWalletTransport({ apiKey: alchemyApiKey }),
    chain,
    account: account.address,
  });

  if (smartAccountAddress) {
    verifyStoredAddress(smartAccountAddress, () =>
      requestClient
        .requestAccount({ creationHint: { accountType: "sma-b" } })
        .then((derived: { address: string }) => derived.address),
    );
  }

  return new SmartAccountService(client, account.address, alchemyFeePolicyId);
};

/**
 * Re-derives the smart account from this phone's signer and compares it with
 * the address ATARA's service supplied. Runs in the background, once per
 * address, and only ever records a result: the stored address is never
 * replaced and nothing is blocked. A legitimate account and a check that could
 * not run must both keep working exactly as before.
 */
const verifyStoredAddress = (
  storedAddress: string,
  derive: () => Promise<string>,
) => {
  const verification = useAddressVerificationStore.getState();
  if (verification.address === storedAddress.toLowerCase()) return;
  verification.setResult(storedAddress, "unverified");
  // Promise.resolve().then(...) turns a synchronous throw from the SDK into a
  // rejection. Without it, a throw here would escape into the service factory
  // and stop the user from paying — the one thing this check must never do.
  Promise.resolve()
    .then(derive)
    .then((derived) => compareDerivedAddress(storedAddress, derived))
    .catch((): AddressVerification => "unverified")
    .then((status) => {
      useAddressVerificationStore.getState().setResult(storedAddress, status);
      if (status === "mismatch") {
        Sentry.captureMessage("Stored smart account does not match this signer's derivation");
      }
    })
    .catch(() => undefined);
};

export class SmartAccountService {
  private client: any;
  private smartAccountAddress: `0x${string}`;
  /** The Alchemy Gas Manager policy that lets the user pay the network fee in USDC (ERC-20 payments). */
  private feePolicyId?: string;

  constructor(
    client: any,
    smartAccountAddress: `0x${string}`,
    feePolicyId?: string,
  ) {
    this.client = client;
    this.smartAccountAddress = smartAccountAddress;
    this.feePolicyId = feePolicyId;
  }

  /** The wallet this service pays from. */
  get address(): `0x${string}` {
    return this.smartAccountAddress;
  }

  /**
   * What this phone knows about the payment it is waiting on, from its own
   * storage only. See services/paymentOperations.ts for the rules.
   */
  async peekPendingOperation() {
    return getPaymentOperations().peek(this.smartAccountAddress);
  }

  /**
   * Asks the wallet provider and the chain about the payment this phone is
   * waiting on. Never resubmits it, and never concludes it failed from silence.
   */
  async checkPendingOperation(): Promise<OperationReport> {
    return getPaymentOperations().check(this.smartAccountAddress);
  }

  /**
   * Lets the owner pay again after a payment nobody can prove. Only on their
   * explicit request, once they have been told that it may have gone through.
   * The payment stays on a watch list, so a late landing is reported.
   */
  async releasePendingOperation(): Promise<void> {
    await getPaymentOperations().release(this.smartAccountAddress);
  }

  private async sendAndWaitForTxHash(
    uo: {
      target: `0x${string}`;
      value: bigint;
      data: `0x${string}` | string;
    },
    overrides?: Record<string, unknown>,
    options?: SendOptions,
  ): Promise<TransactionResult> {
    return this.sendCallsAndWait(
      [{ target: uo.target, value: uo.value, data: uo.data }],
      overrides,
      options,
    );
  }

  private async sendCallsAndWait(
    calls: SmartAccountCall[],
    overrides?: Record<string, unknown>,
    options?: SendOptions,
  ): Promise<TransactionResult> {
    const operations = getPaymentOperations();
    return runExclusiveOperation(operations.lockKey(this.smartAccountAddress), () =>
      submitAndConfirm({
        client: this.client,
        ops: operations,
        account: this.smartAccountAddress,
        calls: calls.map((call) => ({ target: call.target, value: call.value, data: String(call.data) })),
        overrides,
        onSubmitted: options?.onSubmitted,
        onPrepared: (prepared) => void checkPreparedFee(prepared, this.feeTokenAddress, options?.feeGuard),
      }),
    );
  }

  private get feeTokenAddress(): string {
    return getTokenAddress("USDC", APP_NETWORK);
  }

  /**
   * The user pays the network fee in USDC, from the same account (Alchemy's
   * ERC-20 paymaster, post-operation mode with an exact approval). One signature,
   * no permit and no separate approval transaction. Never a bare sponsorship
   * policy, and never ETH.
   */
  private getFeeCapabilities(estimateOnly = false): Record<string, unknown> {
    if (!this.feePolicyId) throw createFeeError("FEE_SERVICE");
    return {
      paymaster: {
        policyId: this.feePolicyId,
        ...(estimateOnly ? { onlyEstimation: true } : {}),
        erc20: {
          tokenAddress: this.feeTokenAddress,
          postOpSettings: { autoApprove: true },
        },
      },
    };
  }

  private transferCall(params: {
    recipientAddress: string;
    tokenSymbol: string;
    tokenAddress?: string;
    /** In base units of the token (wei for ETH). */
    units: bigint;
  }): SmartAccountCall {
    if (params.tokenSymbol === "ETH") {
      return { target: params.recipientAddress as `0x${string}`, value: params.units, data: "0x" };
    }
    if (!params.tokenAddress) throw new Error(`Token address required for ${params.tokenSymbol} transfers`);
    return {
      target: params.tokenAddress as `0x${string}`,
      value: 0n,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [params.recipientAddress as `0x${string}`, params.units],
      }),
    };
  }

  /**
   * The largest network fee, in USDC base units, a payment to this recipient in
   * this token would cost. A quote only: it is never signed, and Alchemy is asked
   * for an estimate so it does not count against the policy's pending total. The
   * fee does not depend on the amount, so the probe moves one base unit.
   * Throws FEE_UNAVAILABLE when no real fee comes back; it never invents one.
   */
  async estimateFee(params: {
    recipientAddress: string;
    tokenSymbol: string;
    tokenAddress?: string;
  }): Promise<bigint> {
    try {
      if (!this.client) throw new Error("Smart account client not available");
      const call = this.transferCall({ ...params, units: 1n });
      const prepared = await this.client.prepareCalls({
        account: this.smartAccountAddress,
        calls: [{ to: call.target, value: call.value ?? 0n, data: String(call.data) }],
        capabilities: this.getFeeCapabilities(true),
      });
      const fee = usableFee(prepared, this.feeTokenAddress);
      if (fee === null) throw createFeeError("FEE_UNAVAILABLE");
      return fee;
    } catch (error) {
      if (isFeeError(error)) throw error;
      Sentry.captureException(error);
      throw createFeeError("FEE_UNAVAILABLE");
    }
  }

  async sendETH(
    recipientAddress: string,
    amount: string,
    options?: SendOptions,
  ): Promise<TransactionResult> {
    if (!this.client) {
      throw new Error("Smart account client not available");
    }

    try {
      const result = await this.sendAndWaitForTxHash({
        target: recipientAddress as `0x${string}`,
        value: parseEther(amount),
        data: "0x",
      }, this.getFeeCapabilities(), options);

      return result;
    } catch (error: any) {
      console.error("ETH transfer failed:", error);
      Sentry.captureException(error);
      throw createTransactionError(error?.message || "ETH transfer failed", {
        cause: error,
      });
    }
  }

  async sendToken(
    recipientAddress: string,
    amount: string,
    tokenAddress: string,
    decimals: number = 6,
    options?: SendOptions,
  ): Promise<TransactionResult> {
    if (!this.client) {
      throw new Error("Smart account client not available");
    }

    try {
      const parsedAmount = parseUnits(amount, decimals);

      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [recipientAddress as `0x${string}`, parsedAmount],
      });

      const result = await this.sendAndWaitForTxHash({
        target: tokenAddress as `0x${string}`,
        value: 0n,
        data: transferData,
      }, this.getFeeCapabilities(), options);

      return result;
    } catch (error: any) {
      console.error("Token transfer failed:", error);
      Sentry.captureException(error);
      throw createTransactionError(error?.message || "Token transfer failed", {
        cause: error,
      });
    }
  }

  async sendTransaction(
    params: SendTransactionParams,
    options?: SendOptions,
  ): Promise<TransactionResult> {
    const { recipientAddress, amount, tokenSymbol, tokenAddress, decimals } =
      params;

    if (!recipientAddress || !amount || !tokenSymbol) {
      throw new Error("Missing required transaction parameters");
    }

    if (parseFloat(amount) <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (tokenSymbol === "ETH") {
      return this.sendETH(recipientAddress, amount, options);
    } else {
      if (!tokenAddress) {
        throw new Error(`Token address required for ${tokenSymbol} transfers`);
      }
      return this.sendToken(recipientAddress, amount, tokenAddress, decimals, options);
    }
  }

  /** Execute an ordered smart-account batch, such as approve + deposit. */
  async sendContractCalls(calls: SmartAccountCall[]): Promise<TransactionResult> {
    if (!this.client) throw new Error("Smart account client not available");
    if (calls.length === 0) throw new Error("At least one contract call is required");

    try {
      return await this.sendCallsAndWait(calls, this.getFeeCapabilities());
    } catch (error: any) {
      Sentry.captureException(error);
      throw createTransactionError(error?.message || "Contract transaction failed", {
        cause: error,
      });
    }
  }

  getSmartAccountAddress(): string | undefined {
    return this.smartAccountAddress;
  }
}

export const useSmartAccountService = () => {
  const { wallets } = useEmbeddedEthereumWallet();
  const { wallet: externalWallet } = useExternalWallet();
  const [service, setService] = useState<SmartAccountService | null>(null);
  const smartAccountAddress = useAuthStore(
    (state) => state.user?.smartAccountAddress,
  );
  const authProvider = useAuthStore((state) => state.user?.authProvider);

  useEffect(() => {
    let cancelled = false;

    const buildService = async () => {
      const wallet =
        authProvider === "external_wallet"
          ? externalWallet
          : (wallets[0] as EthereumSignerWallet | undefined);

      if (!wallet) {
        if (!cancelled) {
          setService(null);
        }
        return;
      }

      try {
        const nextService = await createAlchemySmartAccountService({
          wallet,
          smartAccountAddress,
        });

        if (!cancelled) {
          setService(nextService);
        }
      } catch (error) {
        console.error("Failed to initialize smart account service:", error);
        Sentry.captureException(error);
        if (!cancelled) {
          setService(null);
        }
      }
    };

    void buildService();

    return () => {
      cancelled = true;
    };
  }, [authProvider, externalWallet, wallets, smartAccountAddress]);

  return service;
};
