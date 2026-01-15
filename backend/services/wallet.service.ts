import axios from "axios";
import { ErrorHandler } from "../utils/errorHandler";
import prisma from "../config/prisma";
import { ethers } from "ethers";
import { RPC_URL } from "../utils/constants";

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

const provider = new ethers.JsonRpcProvider(RPC_URL);

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
    currency: string = "usd"
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
        }
      );

      if (Object.keys(response.data).length === 0) {
        throw new ErrorHandler(
          `No price data found for the provided tokens: ${idsParam}`,
          404
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
    limit: number = 20
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
        }
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
      select: { publicAddress: true },
    });

    if (!user || !user.publicAddress) {
      throw new ErrorHandler("User wallet not found", 404);
    }

    const balanceWei = await provider.getBalance(user.publicAddress);

    const balanceEth = ethers.formatEther(balanceWei);

    // For M1 (Base Sepolia), we only have ETH. Future updates can add ERC-20 tokens here.
    return [
      {
        asset: "ETH",
        balance: parseFloat(balanceEth),
        rawBalance: balanceWei.toString(),
        network: "Base Sepolia",
      },
    ];
  }
}

export const walletService = new WalletService();
