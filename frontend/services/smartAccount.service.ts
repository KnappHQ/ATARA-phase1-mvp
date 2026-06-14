import { useSmartAccountClient, useUser } from "@account-kit/react-native";
import { parseEther, parseUnits, encodeFunctionData } from "viem";
import * as Sentry from "@sentry/react-native";

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
];

const SELF_FUNDED_USER_OPERATION_OVERRIDES = {
  paymasterAndData: "0x" as const,
};

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

export class SmartAccountService {
  private client: any;
  private user: any;

  constructor(client: any, user: any) {
    this.client = client;
    this.user = user;
  }

  /**
   * Sends a UserOperation and waits for the actual transaction hash.
   *
   * sendUserOperation() returns a UserOperation hash (NOT a tx hash).
   * We must call waitForUserOperationTransaction() to get the real
   * mined transaction hash that can be looked up on-chain.
   */
  private async sendAndWaitForTxHash(
    uo: {
      target: `0x${string}`;
      value: bigint;
      data: `0x${string}` | string;
    },
    overrides?: Record<string, unknown>,
  ): Promise<TransactionResult> {
    // Step 1: Send the UserOperation (gas sponsorship is handled automatically
    // by the client via gasManagerConfig.policyId set in createConfig)
    const { hash: userOpHash } = await this.client.sendUserOperation({
      uo,
      ...(overrides ? { overrides } : {}),
    });

    // Step 2: Wait for the UserOp to be bundled into an actual transaction
    // This returns the real on-chain transaction hash
    const txHash = await this.client.waitForUserOperationTransaction({
      hash: userOpHash,
    });

    return { hash: txHash, userOpHash, success: true };
  }

  async sendETHWithGas(
    recipientAddress: string,
    amount: string,
  ): Promise<TransactionResult> {
    if (!this.client) {
      throw new Error("Smart account client not available");
    }

    try {
      return await this.sendAndWaitForTxHash(
        {
          target: recipientAddress as `0x${string}`,
          value: parseEther(amount),
          data: "0x",
        },
        SELF_FUNDED_USER_OPERATION_OVERRIDES,
      );
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

      return await this.sendAndWaitForTxHash(
        {
          target: tokenAddress as `0x${string}`,
          value: 0n,
          data: transferData,
        },
        SELF_FUNDED_USER_OPERATION_OVERRIDES,
      );
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
      });

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
      });

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
    return this.client?.account?.address;
  }
}

export const useSmartAccountService = () => {
  const { client } = useSmartAccountClient({
    type: "ModularAccountV2",
  });
  const user = useUser();

  if (!client || !user) {
    return null;
  }

  return new SmartAccountService(client, user);
};
