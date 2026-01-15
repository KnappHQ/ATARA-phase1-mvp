import { useState, useEffect, useCallback } from "react";
import { TransactionService } from "../services/transaction.service";

export const useGasEstimation = (
  recipientAddress?: string,
  amount?: string
) => {
  const [networkFee, setNetworkFee] = useState("0.00");
  const [isEstimating, setIsEstimating] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const estimate = async () => {
      if (isMounted) setIsEstimating(true);

      if (!recipientAddress || !amount) {
        if (isMounted) setIsEstimating(false);
        return;
      }

      try {
        const { estimatedFee } = await TransactionService.estimateTransaction(
          recipientAddress,
          amount
        );
        if (isMounted) setNetworkFee(estimatedFee);
      } catch (e) {
        console.warn("Gas estimation failed", e);
        // Fallback for UI if estimation fails
        if (isMounted) setNetworkFee("0.0001");
      } finally {
        if (isMounted) setIsEstimating(false);
      }
    };

    estimate();

    return () => {
      isMounted = false;
    };
  }, [recipientAddress, amount]);

  return { networkFee, isEstimating };
};
