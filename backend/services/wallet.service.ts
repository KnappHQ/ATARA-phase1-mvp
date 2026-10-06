import axios from "axios";
import { ErrorHandler } from "../utils/errorHandler";
import prisma from "../config/prisma";
import { ethers } from "ethers";
import { ALCHEMY_URL, ALCHEMY_KEY } from "../utils/constants";
import { NETWORK } from "../utils/constants";
import { getKnownTokens } from "../utils/tokenConfig";
import { logError } from "../utils/logger";
import { buildPortfolio, resolveQuote, type HoldingInput } from "../utils/portfolioPricing";

const KNOWN_TOKENS = getKnownTokens(NETWORK as "base-sepolia" | "base-mainnet");

const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_URL);

class WalletService {
  public async getUserPortfolio(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { smartAccountAddress: true },
    });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    const walletAddress = user.smartAccountAddress;

    if (!walletAddress) {
      throw new ErrorHandler("Wallet address not found", 404);
    }

    try {
      // Fetch balances and prices in parallel
      const [ethBalance, tokenBalances, currentPrices, historicalPrices] =
        await Promise.all([
          this.getETHBalance(walletAddress),
          this.getTokenBalances(walletAddress),
          this.getCurrentPrices(["ETH", "USDT", "USDC"]),
          this.getHistoricalPrices(["ETH", "USDT", "USDC"]),
        ]);

      const at = Date.now();
      const holding = (
        symbol: string,
        name: string,
        amount: string,
        displayDecimals: number,
        decimals: number,
        contractAddress?: string,
      ): HoldingInput => ({
        symbol,
        name,
        amount: parseFloat(amount),
        displayDecimals,
        decimals,
        contractAddress,
        quote: resolveQuote(symbol, currentPrices[symbol] ?? null, at),
        price24hAgo: historicalPrices[symbol] ?? null,
      });

      return buildPortfolio([
        holding("ETH", "Ethereum", ethBalance, 6, 18),
        holding("USDT", "Tether USD", tokenBalances.USDT, 2, 6, KNOWN_TOKENS.USDT.address),
        holding("USDC", "USD Coin", tokenBalances.USDC, 2, 6, KNOWN_TOKENS.USDC.address),
      ]);
    } catch (error: any) {
      logError("wallet.portfolio", error);
      // A fixed message on purpose. The provider's own error text can carry
      // the RPC URL, and Alchemy's URL contains the API key.
      throw new ErrorHandler("Balance data is temporarily unavailable", 503);
    }
  }

  /**
   * ETH balance for an address. A failed read throws: returning "0" here told
   * the app the wallet was empty, which is a claim about someone's money that
   * nobody had checked.
   */
  private async getETHBalance(address: string): Promise<string> {
    const balanceWei = await provider.getBalance(address);
    return ethers.utils.formatEther(balanceWei);
  }

  /**
   * ERC-20 balances via Alchemy. Throws on failure, for the same reason as
   * getETHBalance. A token that is genuinely not configured is still "0": that
   * is a fact about the configuration, not a failed read.
   */
  private async getTokenBalances(
    address: string,
  ): Promise<{ USDT: string; USDC: string }> {
    const trackedTokens = Object.values(KNOWN_TOKENS).filter(
      (token) => token.address,
    );

    if (trackedTokens.length === 0) {
      return { USDT: "0", USDC: "0" };
    }

    const response = await axios.post(ALCHEMY_URL, {
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getTokenBalances",
      params: [address, trackedTokens.map((token) => token.address)],
    });

    if (response.data.error) {
      throw new Error("Token balance provider returned an error");
    }

    const tokenBalances = response.data.result?.tokenBalances;
    if (!Array.isArray(tokenBalances)) {
      throw new Error("Token balance provider returned no balances");
    }

    const getBalance = (symbol: keyof typeof KNOWN_TOKENS) => {
      const token = KNOWN_TOKENS[symbol];

      if (!token.address) {
        return "0";
      }

      const balance = tokenBalances.find(
        (t: any) =>
          t.contractAddress?.toLowerCase() === token.address.toLowerCase(),
      );

      return ethers.utils.formatUnits(
        balance?.tokenBalance || "0",
        token.decimals,
      );
    };

    return {
      USDT: getBalance("USDT"),
      USDC: getBalance("USDC"),
    };
  }

  /**
   * Get current prices from Alchemy Prices API
   */
  private async getCurrentPrices(
    symbols: string[],
  ): Promise<Record<string, number | null>> {
    const prices: Record<string, number | null> = {};
    const pricesURL = "https://api.g.alchemy.com/prices/v1";

    try {
      const pricePromises = symbols.map(async (symbol) => {
        try {
          const response = await axios.get(
            `${pricesURL}/tokens/by-symbol?symbols=${symbol}`,
            {
              headers: {
                Authorization: `Bearer ${ALCHEMY_KEY}`,
              },
            },
          );

          if (
            response.data.data &&
            response.data.data.length > 0 &&
            response.data.data[0].prices &&
            response.data.data[0].prices.length > 0
          ) {
            prices[symbol] = parseFloat(response.data.data[0].prices[0].value);
          } else {
            prices[symbol] = null;
          }
        } catch (error) {
          logError("wallet.price", error, { symbol });
          prices[symbol] = null;
        }
      });

      await Promise.all(pricePromises);
      return prices;
    } catch (error) {
      logError("wallet.prices", error);
      return Object.fromEntries(symbols.map((symbol) => [symbol, null]));
    }
  }

  /**
   * Get 24h ago prices from Alchemy Historical Prices API
   */
  private async getHistoricalPrices(
    symbols: string[],
  ): Promise<Record<string, number | null>> {
    const prices: Record<string, number | null> = {};
    const pricesURL = "https://api.g.alchemy.com/prices/v1";

    const now = new Date();
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);

    try {
      const pricePromises = symbols.map(async (symbol) => {
        try {
          const response = await axios.post(
            `${pricesURL}/${ALCHEMY_KEY}/tokens/historical`,
            {
              symbol: symbol,
              startTime: twentyFiveHoursAgo.toISOString(),
              endTime: now.toISOString(),
              interval: "1d",
            },
          );

          if (
            response.data.data &&
            Array.isArray(response.data.data) &&
            response.data.data.length > 0 &&
            response.data.data[0].value
          ) {
            // Get first price (24h ago)
            prices[symbol] = parseFloat(response.data.data[0].value);
          } else {
            // No old price: the 24 h change is unknown, not "no change".
            prices[symbol] = null;
          }
        } catch (error) {
          logError("wallet.historical-price", error, { symbol });
          prices[symbol] = null;
        }
      });

      await Promise.all(pricePromises);
      return prices;
    } catch (error) {
      logError("wallet.historical-prices", error);
      return Object.fromEntries(symbols.map((symbol) => [symbol, null]));
    }
  }
}

export const walletService = new WalletService();
