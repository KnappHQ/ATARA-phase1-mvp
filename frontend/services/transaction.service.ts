import "../shim";
import { ethers } from "ethers";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { PROVIDER_URL } from "../utils/constants";

const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);

export type TxStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface TransactionHistoryItem {
  id: string;
  senderId: string;
  receiverId: string | null;
  receiverAddress: string;
  txHash: string;
  assetSymbol: string;
  amount: string;
  rawAmountWei: string | null;
  category: string | null;
  userNote: string | null;
  status: TxStatus;
  createdAt: string;

  // Relations
  sender: {
    handle: string;
    profilePicUrl: string | null;
    publicAddress: string;
  };
  receiver: {
    handle: string;
    profilePicUrl: string | null;
    publicAddress: string;
  } | null;
}
export const TransactionService = {
  estimateTransaction: async (toAddress: string, amountEth: string) => {
    try {
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice;

      if (!gasPrice) throw new Error("Could not fetch gas price");

      const estimatedGas = await provider.estimateGas({
        to: toAddress,
        value: ethers.utils.parseEther(amountEth),
      });

      const totalFeeWei = estimatedGas.mul(gasPrice);

      return {
        estimatedFee: ethers.utils.formatEther(totalFeeWei),
      };
    } catch (error) {
      console.error("Gas estimation failed", error);
      throw new Error("Could not estimate gas. Address might be invalid.");
    }
  },

  sendTransaction: async (
    toAddress: string,
    amountEth: string,
    symbol: string = "ETH"
  ) => {
    const privateKey = await SecureStore.getItemAsync("auth_private_key");
    if (!privateKey) throw new Error("Wallet not found on device");

    const wallet = new ethers.Wallet(privateKey, provider);
    const amountWei = ethers.utils.parseEther(amountEth);

    const txResponse = await wallet.sendTransaction({
      to: toAddress,
      value: amountWei,
    });

    console.log("Broadcasted Tx:", txResponse.hash);

    try {
      await api.post("/transaction/sync", {
        txHash: txResponse.hash,
        receiverAddress: toAddress,
        amount: amountEth,
        rawAmountWei: amountWei.toString(),
        assetSymbol: symbol,
        category: "transfer",
      });
    } catch (apiError) {
      console.warn("Backend sync failed, but tx sent:", apiError);
    }

    return txResponse;
  },

  getHistory: async (): Promise<TransactionHistoryItem[]> => {
    try {
      const { data } = await api.get<{ history: TransactionHistoryItem[] }>(
        "/transaction/history"
      );
      return data.history;
    } catch (error) {
      console.error("Failed to fetch history", error);
      return [];
    }
  },
};
