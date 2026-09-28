import axios from "axios";
import { ErrorHandler } from "../utils/errorHandler";
import prisma from "../config/prisma";
import { ethers } from "ethers";
import { ALCHEMY_URL, ALCHEMY_KEY } from "../utils/constants";
import { NETWORK } from "../utils/constants";
import { getKnownTokens } from "../utils/tokenConfig";
import { logError } from "../utils/logger";

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

      // Build token data with balances and USD values
      const tokens = [];
      let totalUSD = 0;
      let totalUSD24hAgo = 0;

      // ETH
      const ethBalanceNum = parseFloat(ethBalance);
      const ethCurrentPrice = currentPrices.ETH || 0;
      const ethPrice24hAgo = historicalPrices.ETH || ethCurrentPrice;
      const ethUSDValue = ethBalanceNum * ethCurrentPrice;
      const ethUSDValue24hAgo = ethBalanceNum * ethPrice24hAgo;

      tokens.push({
        symbol: "ETH",
        name: "Ethereum",
        balance: ethBalanceNum.toFixed(6),
        usdValue: ethUSDValue,
        usdPrice: ethCurrentPrice,
        change24h: ethUSDValue - ethUSDValue24hAgo,
        percentChange24h:
          ethPrice24hAgo > 0
            ? ((ethCurrentPrice - ethPrice24hAgo) / ethPrice24hAgo) * 100
            : 0,
        decimals: 18,
      });

      totalUSD += ethUSDValue;
      totalUSD24hAgo += ethUSDValue24hAgo;

      // USDT
      const usdtBalance = parseFloat(tokenBalances.USDT);
      const usdtCurrentPrice = currentPrices.USDT || 1;
      const usdtPrice24hAgo = historicalPrices.USDT || usdtCurrentPrice;
      const usdtUSDValue = usdtBalance * usdtCurrentPrice;
      const usdtUSDValue24hAgo = usdtBalance * usdtPrice24hAgo;

      tokens.push({
        symbol: "USDT",
        name: "Tether USD",
        balance: usdtBalance.toFixed(2),
        usdValue: usdtUSDValue,
        usdPrice: usdtCurrentPrice,
        change24h: usdtUSDValue - usdtUSDValue24hAgo,
        percentChange24h:
          usdtPrice24hAgo > 0
            ? ((usdtCurrentPrice - usdtPrice24hAgo) / usdtPrice24hAgo) * 100
            : 0,
        decimals: 6,
        contractAddress: KNOWN_TOKENS.USDT.address,
      });

      totalUSD += usdtUSDValue;
      totalUSD24hAgo += usdtUSDValue24hAgo;

      // USDC
      const usdcBalance = parseFloat(tokenBalances.USDC);
      const usdcCurrentPrice = currentPrices.USDC || 1;
      const usdcPrice24hAgo = historicalPrices.USDC || usdcCurrentPrice;
      const usdcUSDValue = usdcBalance * usdcCurrentPrice;
      const usdcUSDValue24hAgo = usdcBalance * usdcPrice24hAgo;

      tokens.push({
        symbol: "USDC",
        name: "USD Coin",
        balance: usdcBalance.toFixed(2),
        usdValue: usdcUSDValue,
        usdPrice: usdcCurrentPrice,
        change24h: usdcUSDValue - usdcUSDValue24hAgo,
        percentChange24h:
          usdcPrice24hAgo > 0
            ? ((usdcCurrentPrice - usdcPrice24hAgo) / usdcPrice24hAgo) * 100
            : 0,
        decimals: 6,
        contractAddress: KNOWN_TOKENS.USDC.address,
      });

      totalUSD += usdcUSDValue;
      totalUSD24hAgo += usdcUSDValue24hAgo;

      const change24h = totalUSD - totalUSD24hAgo;
      const percentChange24h =
        totalUSD24hAgo > 0 ? (change24h / totalUSD24hAgo) * 100 : 0;

      return {
        totalUSD: parseFloat(totalUSD.toFixed(2)),
        change24h: parseFloat(change24h.toFixed(2)),
        percentChange24h: parseFloat(percentChange24h.toFixed(2)),
        tokens,
      };
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
  ): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
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
            prices[symbol] = symbol === "ETH" ? 3000 : 1;
          }
        } catch (error) {
          logError("wallet.price", error, { symbol });
          prices[symbol] = symbol === "ETH" ? 3000 : 1;
        }
      });

      await Promise.all(pricePromises);
      return prices;
    } catch (error) {
      logError("wallet.prices", error);
      return { ETH: 3000, USDT: 1, USDC: 1 };
    }
  }

  /**
   * Get 24h ago prices from Alchemy Historical Prices API
   */
  private async getHistoricalPrices(
    symbols: string[],
  ): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
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
            // Fallback to current price (no change)
            prices[symbol] = symbol === "ETH" ? 3000 : 1;
          }
        } catch (error) {
          logError("wallet.historical-price", error, { symbol });
          prices[symbol] = symbol === "ETH" ? 3000 : 1;
        }
      });

      await Promise.all(pricePromises);
      return prices;
    } catch (error) {
      logError("wallet.historical-prices", error);
      return { ETH: 3000, USDT: 1, USDC: 1 };
    }
  }
}

export const walletService = new WalletService();
