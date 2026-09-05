import { ethers } from "ethers";
import axios from "axios";
import { ErrorHandler } from "./errorHandler";
import { ALCHEMY_URL } from "./constants";
import type { TokenConfig } from "./tokenConfig";

/**
 * On-chain verification helpers.
 *
 * The rule enforced here: a transaction is only ever accepted on the strength
 * of what the chain says it did. Nothing supplied by the client (amounts,
 * recipients, token symbols, prices) is trusted, and when verification cannot
 * be completed the request is REFUSED rather than waved through.
 *
 * Note on ERC-4337: these are smart-account transactions, so `receipt.from` is
 * the bundler and `receipt.to` is the EntryPoint - never the user. The real
 * movement of value is therefore read from the ERC-20 `Transfer` logs (exact,
 * always present in the receipt) and, for native ETH, from Alchemy's internal
 * transfer index scoped to the transaction's own block.
 */

const TRANSFER_TOPIC = ethers.utils.id("Transfer(address,address,uint256)");

const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_URL);

export type VerifiedTransfer = {
  from: string;
  to: string;
  rawAmount: ethers.BigNumber;
  blockNumber: number;
};

const topicToAddress = (topic: string): string =>
  ethers.utils.getAddress("0x" + topic.slice(26)).toLowerCase();

const normalize = (address: string): string => address.trim().toLowerCase();

const getVerifiedReceipt = async (txHash: string) => {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new ErrorHandler("Invalid transaction hash", 400);
  }

  let receipt: ethers.providers.TransactionReceipt | null;
  try {
    receipt = await provider.getTransactionReceipt(txHash);
  } catch {
    // Refuse rather than guess when the RPC is unreachable.
    throw new ErrorHandler(
      "Unable to verify the transaction on-chain right now. Please retry.",
      503,
    );
  }

  if (!receipt) {
    throw new ErrorHandler(
      "Transaction not found on-chain. It may still be pending.",
      202,
    );
  }

  if (receipt.status !== 1) {
    throw new ErrorHandler("Transaction failed on-chain", 400);
  }

  return receipt;
};

/**
 * Verify that `txHash` moved `token` from `expectedFrom` to `expectedTo`,
 * and return the amount the chain actually recorded.
 */
export type MinimalLog = {
  address: string;
  topics: string[];
  data: string;
};

/**
 * Sum the `Transfer` events in `logs` that moved `tokenAddress` from
 * `expectedFrom` to `expectedTo`. Returns `null` when there is no such
 * transfer - which is a refusal, not a zero.
 *
 * Pure, so it can be exercised directly in tests.
 */
export const sumErc20Transfers = (
  logs: MinimalLog[],
  tokenAddress: string,
  expectedFrom: string,
  expectedTo: string,
): ethers.BigNumber | null => {
  const token = normalize(tokenAddress);
  const from = normalize(expectedFrom);
  const to = normalize(expectedTo);

  let total = ethers.BigNumber.from(0);
  let matched = false;

  for (const log of logs) {
    // The contract address is the check that matters: without it, any ERC-20
    // that merely calls itself "USDC" would be accepted as the real thing.
    if (normalize(log.address) !== token) continue;
    if (log.topics[0] !== TRANSFER_TOPIC) continue;
    if (log.topics.length < 3) continue;
    if (topicToAddress(log.topics[1]) !== from) continue;
    if (topicToAddress(log.topics[2]) !== to) continue;

    matched = true;
    total = total.add(ethers.BigNumber.from(log.data));
  }

  return matched ? total : null;
};

export const verifyErc20Transfer = async (params: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  token: TokenConfig;
}): Promise<VerifiedTransfer> => {
  const { txHash, token } = params;
  const expectedFrom = normalize(params.expectedFrom);
  const expectedTo = normalize(params.expectedTo);

  const receipt = await getVerifiedReceipt(txHash);

  const total = sumErc20Transfers(
    receipt.logs,
    token.address,
    expectedFrom,
    expectedTo,
  );

  if (total === null) {
    throw new ErrorHandler(
      `This transaction contains no ${token.symbol} transfer from the sender to the stated recipient.`,
      400,
    );
  }

  return {
    from: expectedFrom,
    to: expectedTo,
    rawAmount: total,
    blockNumber: receipt.blockNumber,
  };
};

/**
 * Verify a native ETH transfer.
 *
 * The value moves in an internal call made by the smart account, which leaves
 * no log in the receipt, so this reads Alchemy's internal transfer index -
 * scoped to the transaction's own block, which makes the lookup exact and
 * bounded instead of scanning a 100-item window of account history.
 */
export const verifyNativeTransfer = async (params: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
}): Promise<VerifiedTransfer> => {
  const { txHash } = params;
  const expectedFrom = normalize(params.expectedFrom);
  const expectedTo = normalize(params.expectedTo);

  const receipt = await getVerifiedReceipt(txHash);
  const blockHex = ethers.utils.hexValue(receipt.blockNumber);

  let transfers: any[];
  try {
    const response = await axios.post(ALCHEMY_URL, {
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromBlock: blockHex,
          toBlock: blockHex,
          fromAddress: expectedFrom,
          toAddress: expectedTo,
          category: ["external", "internal"],
          withMetadata: false,
          excludeZeroValue: true,
          maxCount: "0x3e8",
        },
      ],
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    transfers = response.data.result?.transfers ?? [];
  } catch {
    throw new ErrorHandler(
      "Unable to verify the ETH transfer on-chain right now. Please retry.",
      503,
    );
  }

  const normalizedHash = txHash.toLowerCase();
  const matching = transfers.filter(
    (t) => String(t.hash).toLowerCase() === normalizedHash,
  );

  if (matching.length === 0) {
    // Fail closed: the indexer may simply be behind, so ask the caller to
    // retry. It must never mean "record it unverified".
    throw new ErrorHandler(
      "ETH transfer not yet verifiable on-chain. Please retry in a few moments.",
      202,
    );
  }

  let total = ethers.BigNumber.from(0);
  for (const transfer of matching) {
    const raw = transfer.rawContract?.value;
    total = total.add(
      raw
        ? ethers.BigNumber.from(raw)
        : ethers.utils.parseEther(String(transfer.value ?? "0")),
    );
  }

  return {
    from: expectedFrom,
    to: expectedTo,
    rawAmount: total,
    blockNumber: receipt.blockNumber,
  };
};

/**
 * Verify a transfer of any supported asset, returning what the chain recorded.
 * `token` must be provided for every non-ETH asset - a missing token config is
 * a refusal, never a bypass.
 */
export const verifyTransfer = async (params: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  assetSymbol: string;
  token?: TokenConfig;
}): Promise<VerifiedTransfer> => {
  if (params.assetSymbol === "ETH") {
    return verifyNativeTransfer(params);
  }

  if (!params.token) {
    throw new ErrorHandler(
      `Unsupported or unconfigured asset: ${params.assetSymbol}`,
      400,
    );
  }

  return verifyErc20Transfer({
    txHash: params.txHash,
    expectedFrom: params.expectedFrom,
    expectedTo: params.expectedTo,
    token: params.token,
  });
};
