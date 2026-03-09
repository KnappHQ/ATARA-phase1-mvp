import {
  TransactionService,
  SendTransactionRequest,
} from "./transaction.service";
import { api } from "./api";

interface PortfolioResponse {
  totalUSD: number;
  change24h: number;
  percentChange24h: number;
  tokens: Array<{
    symbol: string;
    name: string;
    balance: string;
    usdValue: number;
    usdPrice: number;
    change24h: number;
    percentChange24h: number;
    decimals: number;
    contractAddress?: string;
  }>;
}

export const WalletService = {
  getPortfolio: async (): Promise<PortfolioResponse> => {
    const response = await api.get("/wallet/portfolio");
    return response.data.portfolio;
  },

  sendTransaction: async (
    transactionData: SendTransactionRequest,
    smartAccountService: any,
  ) => {
    if (!smartAccountService) {
      throw new Error("Smart account service not available");
    }

    const transactionService = new TransactionService(smartAccountService);
    return await transactionService.sendTransaction(transactionData);
  },
};
