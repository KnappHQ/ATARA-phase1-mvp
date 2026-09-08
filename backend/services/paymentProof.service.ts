import { ethers } from "ethers";
import { ALCHEMY_URL, NETWORK } from "../utils/constants";
import { ErrorHandler } from "../utils/errorHandler";

const transferInterface = new ethers.utils.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
export const paymentChainId = NETWORK === "base-mainnet" ? 8453 : 84532;

export function matchTokenTransfer(logs: ethers.providers.Log[], token: string, recipient: string, sender?: string) {
  const matching = logs.flatMap(log => {
    if (log.address.toLowerCase() !== token.toLowerCase()) return [];
    try {
      const event = transferInterface.parseLog(log);
      if (event.args.to.toLowerCase() !== recipient.toLowerCase() ||
          (sender && event.args.from.toLowerCase() !== sender.toLowerCase()) || event.args.value.isZero()) return [];
      return [{ rawAmount: event.args.value as ethers.BigNumber, sender: String(event.args.from).toLowerCase() }];
    } catch { return []; }
  });
  // Ambiguous bundled payments need explicit reconciliation, never guess a log.
  if (matching.length !== 1) throw new ErrorHandler("Expected one unambiguous transfer of the configured token", 400);
  return matching[0];
}

export async function verifyTokenPayment(input: {
  txHash: string; token: string; recipient: string; sender?: string;
}) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash) || !ethers.utils.isAddress(input.token) ||
      !ethers.utils.isAddress(input.recipient) || (input.sender && !ethers.utils.isAddress(input.sender)))
    throw new ErrorHandler("Invalid payment reference", 400);
  const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_URL);
  const [network, receipt] = await Promise.all([provider.getNetwork(), provider.getTransactionReceipt(input.txHash)]);
  if (network.chainId !== paymentChainId) throw new ErrorHandler("RPC network mismatch", 503);
  if (!receipt || receipt.confirmations < 2) throw new ErrorHandler("Waiting for two network confirmations; retry shortly", 409);
  if (receipt.status !== 1) throw new ErrorHandler("Payment failed on chain", 400);
  const transfer = matchTokenTransfer(receipt.logs, input.token, input.recipient, input.sender);
  const block = await provider.getBlock(receipt.blockNumber);
  if (!block || block.hash !== receipt.blockHash) throw new ErrorHandler("Payment block changed; retry shortly", 409);
  return { ...transfer, chainId: network.chainId, txHash: receipt.transactionHash.toLowerCase(), confirmedAt: new Date(block.timestamp * 1000) };
}


export async function verifyReceiptSigner(address: string, message: string, signature: string) {
  if (!ethers.utils.isAddress(address) || typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature) || signature.length > 8194)
    throw new ErrorHandler("Sign this receipt with the wallet that sent the payment", 400);
  try { if (ethers.utils.verifyMessage(message, signature).toLowerCase() === address.toLowerCase()) return; } catch {}
  const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_URL);
  const abi = new ethers.utils.Interface(["function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)"]);
  try {
    const result = await provider.call({ to: address, data: abi.encodeFunctionData("isValidSignature", [ethers.utils.hashMessage(message), signature]) });
    if (abi.decodeFunctionResult("isValidSignature", result)[0] === "0x1626ba7e") return;
  } catch {}
  throw new ErrorHandler("Receipt signature not verified for the paying wallet", 403);
}
