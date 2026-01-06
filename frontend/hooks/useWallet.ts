import { useState, useEffect } from "react";
import { WalletService } from "../services/wallet.service";
import { useAuthStore } from "@/stores/useAuthStore"; // <--- 1. Import Auth Store

const COIN_MAP: Record<string, string> = {
  ETH: "ethereum",
  BTC: "bitcoin",
  SOL: "solana",
};

export interface CoinAsset {
  symbol: string;
  name: string;
  balance: string;
  rawBalance: string;
  priceUsd: number;
  changepct24h?: number;
  value: string;
  valueRaw?: number;
}

export const useWallet = () => {
  const [assets, setAssets] = useState<CoinAsset[]>([]);
  const [totals, setTotals] = useState({
    balance: 0,
    changeAmount: 0,
    changePercentage: 0,
  });

  const [isLoading, setIsLoading] = useState(false); // Changed default to false (optional but cleaner)

  // 2. Get the authentication status
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    // 3. THE FIX: Stop here if not logged in
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true); // Start loading only if we are actually fetching
      try {
        const [portfolioData, priceData] = await Promise.all([
          WalletService.getPortfolio(),
          WalletService.getPrices("ethereum"),
        ]);

        if (isMounted) {
          let totalValue = 0;
          let totalPreviousValue = 0;

          const mergedAssets = portfolioData.map((item) => {
            const coinId = COIN_MAP[item.asset] || "ethereum";
            const data = priceData[coinId] || {};
            const price = data.usd || 0;
            const change24h = data.usd_24h_change || 0;

            const assetValue = item.balance * price;
            const previousValue = assetValue / (1 + change24h / 100);

            totalValue += assetValue;
            totalPreviousValue += previousValue;

            return {
              symbol: item.asset,
              name: item.asset === "ETH" ? "Ethereum" : item.asset,
              balance: item.balance.toFixed(4),
              rawBalance: item.rawBalance,
              priceUsd: price,
              change24h: change24h,
              value: `$${assetValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              valueRaw: assetValue,
            };
          });

          const changeAmount = totalValue - totalPreviousValue;
          const changePercentage =
            totalPreviousValue > 0
              ? (changeAmount / totalPreviousValue) * 100
              : 0;

          setAssets(mergedAssets);
          setTotals({
            balance: totalValue,
            changeAmount: changeAmount,
            changePercentage: changePercentage,
          });
        }
      } catch (error) {
        console.error("Failed to load wallet data", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]); // <--- 4. Re-run when auth status changes

  return { assets, totals, isLoading };
};
