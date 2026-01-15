import { useMemo } from "react";
import { useMarketStore } from "../stores/useMarketStore";
import { Holding } from "../types/market";

export const usePortfolio = () => {
  const { holdings, marketData, addHolding, removeHolding } = useMarketStore();

  const { richHoldings, totals } = useMemo(() => {
    let totalValue = 0;
    let totalInvested = 0;

    const enriched = holdings.map((h) => {
      const liveCoin = marketData.find(
        (c) => c.symbol.toLowerCase() === h.symbol.toLowerCase()
      );

      const currentPrice = liveCoin ? liveCoin.current_price : h.purchasePrice;
      const currentValue = h.quantity * currentPrice;
      const invested = h.quantity * h.purchasePrice;

      totalValue += currentValue;
      totalInvested += invested;

      return {
        ...h,
        currentPrice,
        currentValue,
        profitLoss: currentValue - invested,
        profitLossPercent:
          invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      } as Holding;
    });

    return {
      richHoldings: enriched,
      totals: {
        totalValue,
        totalInvested,
        totalProfitLoss: totalValue - totalInvested,
        totalProfitLossPercent:
          totalInvested > 0
            ? ((totalValue - totalInvested) / totalInvested) * 100
            : 0,
      },
    };
  }, [holdings, marketData]);

  return { holdings: richHoldings, totals, addHolding, removeHolding };
};
