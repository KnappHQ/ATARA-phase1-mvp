import axios from "axios";
import { ErrorHandler } from "../utils/errorHandler";
import prisma from "../config/prisma";
import { ethers } from "ethers";
import { ALCHEMY_URL, ALCHEMY_KEY } from "../utils/constants";

interface PriceResponse {
  [key: string]: {
    [key: string]: number;
  };
}

interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
}

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
  image_url?: string;
}

const KNOWN_TOKENS = {
  USDT: {
    address: "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2",
    symbol: "USDT",
    decimals: 6,
  },
  USDC: {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    symbol: "USDC",
    decimals: 6,
  },
};

const provider = new ethers.JsonRpcProvider(ALCHEMY_URL);

class WalletService {
  private readonly baseUrl = "https://api.coingecko.com/api/v3";
  private readonly newsDataUrl = "https://newsdata.io/api/1/crypto";

  /**
   * Fetches the current price of multiple cryptocurrencies.
   * @param tokenIds - Array of CoinGecko API IDs (e.g., ['bitcoin', 'ethereum'])
   * @param currency - The target currency (e.g., 'usd', 'inr')
   * @returns object - Object containing prices for requested tokens
   */
  public async getTokenPrice(
    tokenIds: string[],
    currency: string = "usd",
  ): Promise<any> {
    try {
      const idsParam = tokenIds.join(",");

      const response = await axios.get<PriceResponse>(
        `${this.baseUrl}/simple/price`,
        {
          params: {
            ids: idsParam,
            vs_currencies: currency,
            include_24hr_change: "true",
            x_cg_demo_api_key: process.env.COINGECKO_API_KEY,
          },
        },
      );

      if (Object.keys(response.data).length === 0) {
        throw new ErrorHandler(
          `No price data found for the provided tokens: ${idsParam}`,
          404,
        );
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new ErrorHandler("Token or currency not found", 404);
      }
      console.error("CoinGecko API Error:", error);
      throw new ErrorHandler("Failed to fetch price data", 502);
    }
  }

  /**
   * Get Top 20 Coins (For 'Market Pulse' Screen)
   */
  public async getMarketOverview(
    currency: string = "usd",
    limit: number = 20,
  ): Promise<MarketCoin[]> {
    try {
      const response = await axios.get<MarketCoin[]>(
        `${this.baseUrl}/coins/markets`,
        {
          params: {
            vs_currency: currency,
            order: "market_cap_desc",
            per_page: limit,
            page: 1,
            sparkline: false,
            price_change_percentage: "24h",
            x_cg_demo_api_key: process.env.COINGECKO_API_KEY,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error("CoinGecko Market Error:", error);
      throw new ErrorHandler("Failed to fetch market overview", 502);
    }
  }

  public async getCryptoNews(): Promise<NewsItem[]> {
    try {
      const apiKey = process.env.NEWSDATA_API_KEY;
      if (!apiKey) {
        console.warn("Skipping News: No NEWSDATA_API_KEY found in .env");
        return [];
      }

      const response = await axios.get(this.newsDataUrl, {
        params: {
          apikey: apiKey,
          coin: "btc,eth",
          language: "en",
          size: 5,
          removeduplicate: 1,
          sort: "pubdateasc",
        },
      });

      const articles = response.data.results || [];

      return articles.map((article: any) => ({
        title: article.title,
        description: article.description,
        url: article.link,
        source: article.source_id,
        published_at: article.pubDate,
        image_url: article.image_url,
      }));
    } catch (error) {
      console.error("NewsData API Error:", error);
      return [];
    }
  }

  public async getUserPortfolio(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { smartAccountAddress: true, publicAddress: true },
    });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    // Use smart account address (where funds actually live)
    const walletAddress = user.smartAccountAddress || user.publicAddress;

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

      if (usdtBalance > 0) {
        tokens.push({
          symbol: "USDT",
          name: "Tether USD",
          balance: usdtBalance.toFixed(2),
          usdValue: usdtUSDValue,
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
      }

      // USDC
      const usdcBalance = parseFloat(tokenBalances.USDC);
      const usdcCurrentPrice = currentPrices.USDC || 1;
      const usdcPrice24hAgo = historicalPrices.USDC || usdcCurrentPrice;
      const usdcUSDValue = usdcBalance * usdcCurrentPrice;
      const usdcUSDValue24hAgo = usdcBalance * usdcPrice24hAgo;

      if (usdcBalance > 0) {
        tokens.push({
          symbol: "USDC",
          name: "USD Coin",
          balance: usdcBalance.toFixed(2),
          usdValue: usdcUSDValue,
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
      }

      const change24h = totalUSD - totalUSD24hAgo;
      const percentChange24h =
        totalUSD24hAgo > 0 ? (change24h / totalUSD24hAgo) * 100 : 0;

      return {
        totalUSD: parseFloat(totalUSD.toFixed(2)),
        change24h: parseFloat(change24h.toFixed(2)),
        percentChange24h: parseFloat(percentChange24h.toFixed(2)),
        tokenPrices: currentPrices,
        tokens,
      };
    } catch (error: any) {
      console.error("Failed to fetch portfolio:", error);
      throw new ErrorHandler(
        error.message || "Failed to fetch portfolio data",
        500,
      );
    }
  }

  /**
   * Get ETH balance for an address
   */
  private async getETHBalance(address: string): Promise<string> {
    try {
      const balanceWei = await provider.getBalance(address);
      return ethers.formatEther(balanceWei);
    } catch (error) {
      console.error("Failed to get ETH balance:", error);
      return "0";
    }
  }

  /**
   * Get ERC-20 token balances via Alchemy
   */
  private async getTokenBalances(
    address: string,
  ): Promise<{ USDT: string; USDC: string }> {
    try {
      const response = await axios.post(ALCHEMY_URL, {
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [
          address,
          [KNOWN_TOKENS.USDT.address, KNOWN_TOKENS.USDC.address],
        ],
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const tokenBalances = response.data.result?.tokenBalances || [];

      const usdtBalance = tokenBalances.find(
        (t: any) =>
          t.contractAddress.toLowerCase() ===
          KNOWN_TOKENS.USDT.address.toLowerCase(),
      );
      const usdcBalance = tokenBalances.find(
        (t: any) =>
          t.contractAddress.toLowerCase() ===
          KNOWN_TOKENS.USDC.address.toLowerCase(),
      );

      return {
        USDT: ethers.formatUnits(
          BigInt(usdtBalance?.tokenBalance || "0"),
          KNOWN_TOKENS.USDT.decimals,
        ),
        USDC: ethers.formatUnits(
          BigInt(usdcBalance?.tokenBalance || "0"),
          KNOWN_TOKENS.USDC.decimals,
        ),
      };
    } catch (error) {
      console.error("Failed to get token balances:", error);
      return { USDT: "0", USDC: "0" };
    }
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
          console.error(`Failed to get price for ${symbol}:`, error);
          prices[symbol] = symbol === "ETH" ? 3000 : 1;
        }
      });

      await Promise.all(pricePromises);
      return prices;
    } catch (error) {
      console.error("Failed to get current prices:", error);
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
          console.error(`Failed to get historical price for ${symbol}:`, error);
          prices[symbol] = symbol === "ETH" ? 3000 : 1;
        }
      });

      await Promise.all(pricePromises);
      return prices;
    } catch (error) {
      console.error("Failed to get historical prices:", error);
      return { ETH: 3000, USDT: 1, USDC: 1 };
    }
  }
}

export const walletService = new WalletService();
