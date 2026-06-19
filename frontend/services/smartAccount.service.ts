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

import { APP_NETWORK } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";

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

export interface SendTransactionFailure extends Error {
  code?: string;
  cause?: unknown;
  isPaymasterFailure?: boolean;
  canRetryWithGas?: boolean;
}

const PAYMASTER_ERROR_PATTERNS = [
  /paymaster/i,
  /gas sponsor/i,
  /gas sponsorship/i,
  /sponsorship/i,
  /policy/i,
  /limit reached/i,
  /quota/i,
  /insufficient funds for gas/i,
  /simulation/i,
  /validation reverted/i,
  /AA23 reverted/i,
];

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

const isPaymasterFailure = (error: unknown): boolean => {
  const message = normalizeErrorMessage(error);
  return PAYMASTER_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

const createTransactionError = (
  message: string,
  options?: { cause?: unknown; isPaymasterFailure?: boolean },
): SendTransactionFailure => {
  const error = new Error(message) as SendTransactionFailure;
  error.name = "SendTransactionError";
  error.cause = options?.cause;
  error.isPaymasterFailure = options?.isPaymasterFailure;
  error.code = options?.isPaymasterFailure ? "PAYMASTER_FAILURE" : undefined;
  error.canRetryWithGas = options?.isPaymasterFailure ?? false;
  return error;
};

export type PrivyEthereumWallet = {
  address: string;
  getProvider: () => Promise<{
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  }>;
};

export const getAlchemyWalletConfig = () => {
  const alchemyApiKey =
    process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ||
    (Constants.expoConfig?.extra?.EXPO_PUBLIC_ALCHEMY_API_KEY as
      | string
      | undefined);
  const alchemyGasPolicyId =
    process.env.EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID ||
    (Constants.expoConfig?.extra?.EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID as
      | string
      | undefined);

  return { alchemyApiKey, alchemyGasPolicyId };
};

const createPrivyOwnerSigner = async (wallet: PrivyEthereumWallet) => {
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
  wallet: PrivyEthereumWallet;
  smartAccountAddress?: string | null;
}): Promise<SmartAccountService> => {
  const { alchemyApiKey, alchemyGasPolicyId } = getAlchemyWalletConfig();

  if (!alchemyApiKey) {
    throw new Error("Missing EXPO_PUBLIC_ALCHEMY_API_KEY");
  }

  const chain = APP_NETWORK === "base-mainnet" ? base : baseSepolia;
  const signer = await createPrivyOwnerSigner(wallet);
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

  return new SmartAccountService(client, account.address, alchemyGasPolicyId);
};

export class SmartAccountService {
  private client: any;
  private smartAccountAddress: `0x${string}`;
  private gasPolicyId?: string;

  constructor(
    client: any,
    smartAccountAddress: `0x${string}`,
    gasPolicyId?: string,
  ) {
    this.client = client;
    this.smartAccountAddress = smartAccountAddress;
    this.gasPolicyId = gasPolicyId;
  }

  /**
   * Sends a wallet call bundle and waits for the actual transaction hash.
   *
   * sendCalls() returns a bundle id (NOT a tx hash).
   * We must call waitForCallsStatus() to get the mined transaction hash
   * that can be looked up on-chain.
   */
  private async sendAndWaitForTxHash(
    uo: {
      target: `0x${string}`;
      value: bigint;
      data: `0x${string}` | string;
    },
    overrides?: Record<string, unknown>,
  ): Promise<TransactionResult> {
    const { id } = await this.client.sendCalls({
      account: this.smartAccountAddress,
      calls: [
        {
          to: uo.target,
          value: uo.value,
          data: uo.data,
        },
      ],
      ...(overrides ? { capabilities: overrides } : {}),
    });

    const status = await this.client.waitForCallsStatus({
      id,
    });

    const txHash = status.receipts?.[0]?.transactionHash;

    if (!txHash) {
      throw new Error("Transaction completed without a receipt hash");
    }

    return { hash: txHash, success: true };
  }

  private getGaslessCapabilities(): Record<string, unknown> | undefined {
    return this.gasPolicyId
      ? { paymaster: { policyId: this.gasPolicyId } }
      : undefined;
  }

  async sendETHWithGas(
    recipientAddress: string,
    amount: string,
  ): Promise<TransactionResult> {
    if (!this.client) {
      throw new Error("Smart account client not available");
    }

    try {
      return await this.sendAndWaitForTxHash({
        target: recipientAddress as `0x${string}`,
        value: parseEther(amount),
        data: "0x",
      });
    } catch (error: any) {
      throw createTransactionError(error?.message || "ETH transfer failed", {
        cause: error,
        isPaymasterFailure:
          isPaymasterFailure(error) || !!error?.isPaymasterFailure,
      });
    }
  }

  async sendTokenWithGas(
    recipientAddress: string,
    amount: string,
    tokenAddress: string,
    decimals: number = 6,
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

      return await this.sendAndWaitForTxHash({
        target: tokenAddress as `0x${string}`,
        value: 0n,
        data: transferData,
      });
    } catch (error: any) {
      throw createTransactionError(error?.message || "Token transfer failed", {
        cause: error,
        isPaymasterFailure:
          isPaymasterFailure(error) || !!error?.isPaymasterFailure,
      });
    }
  }

  async sendETH(
    recipientAddress: string,
    amount: string,
  ): Promise<TransactionResult> {
    if (!this.client) {
      throw new Error("Smart account client not available");
    }

    try {
      const result = await this.sendAndWaitForTxHash({
        target: recipientAddress as `0x${string}`,
        value: parseEther(amount),
        data: "0x",
      }, this.getGaslessCapabilities());

      return result;
    } catch (error: any) {
      console.error("ETH transfer failed:", error);
      Sentry.captureException(error);
      throw createTransactionError(error?.message || "ETH transfer failed", {
        cause: error,
        isPaymasterFailure:
          isPaymasterFailure(error) || !!error?.isPaymasterFailure,
      });
    }
  }

  async sendToken(
    recipientAddress: string,
    amount: string,
    tokenAddress: string,
    decimals: number = 6,
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
      }, this.getGaslessCapabilities());

      return result;
    } catch (error: any) {
      console.error("Token transfer failed:", error);
      Sentry.captureException(error);
      throw createTransactionError(error?.message || "Token transfer failed", {
        cause: error,
        isPaymasterFailure:
          isPaymasterFailure(error) || !!error?.isPaymasterFailure,
      });
    }
  }

  async sendTransaction(
    params: SendTransactionParams,
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
      return this.sendETH(recipientAddress, amount);
    } else {
      if (!tokenAddress) {
        throw new Error(`Token address required for ${tokenSymbol} transfers`);
      }
      return this.sendToken(recipientAddress, amount, tokenAddress, decimals);
    }
  }

  async sendTransactionWithGas(
    params: SendTransactionParams,
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
      return this.sendETHWithGas(recipientAddress, amount);
    }

    if (!tokenAddress) {
      throw new Error(`Token address required for ${tokenSymbol} transfers`);
    }

    return this.sendTokenWithGas(
      recipientAddress,
      amount,
      tokenAddress,
      decimals,
    );
  }

  getSmartAccountAddress(): string | undefined {
    return this.smartAccountAddress;
  }
}

export const useSmartAccountService = () => {
  const { wallets } = useEmbeddedEthereumWallet();
  const [service, setService] = useState<SmartAccountService | null>(null);
  const smartAccountAddress = useAuthStore(
    (state) => state.user?.smartAccountAddress,
  );

  useEffect(() => {
    let cancelled = false;

    const buildService = async () => {
      const wallet = wallets[0];

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
  }, [wallets, smartAccountAddress]);

  return service;
};
