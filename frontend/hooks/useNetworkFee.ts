import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SmartAccountService } from "@/services/smartAccount.service";
import { createFeeEstimator, type FeeQuote } from "@/utils/feeEstimator";

/**
 * The network fee for paying one recipient in one token, quoted by Alchemy before
 * the person confirms. It follows the recipient and the token; the amount does not
 * change a transfer's fee. `refresh` asks again, for example when the review opens.
 */
export const useNetworkFee = (input: {
  service: SmartAccountService | null;
  recipientAddress: string | null | undefined;
  tokenSymbol: string | null | undefined;
  tokenAddress?: string;
}): { quote: FeeQuote; refresh: () => void; accept: (fee: bigint) => void } => {
  const { service, recipientAddress, tokenSymbol, tokenAddress } = input;
  const [quote, setQuote] = useState<FeeQuote>({ status: "idle" });
  const ready = !!service && !!recipientAddress && !!tokenSymbol;
  const latest = useRef<ReturnType<typeof createFeeEstimator> | null>(null);

  const estimator = useMemo(() => {
    if (!service || !recipientAddress || !tokenSymbol) return null;
    return createFeeEstimator(
      () => service.estimateFee({ recipientAddress, tokenSymbol, tokenAddress }),
      setQuote,
    );
  }, [service, recipientAddress, tokenSymbol, tokenAddress]);

  useEffect(() => {
    latest.current = estimator;
    if (!estimator) {
      setQuote({ status: "idle" });
      return;
    }
    void estimator.run();
    return () => estimator.cancel();
  }, [estimator]);

  const refresh = useCallback(() => {
    if (ready) void latest.current?.run();
  }, [ready]);

  // The exact fee read from a prepared payment: shown as is, any estimate still on its way is dropped.
  const accept = useCallback((fee: bigint) => {
    if (latest.current) latest.current.cancel({ status: "ready", maxFee: fee });
    else setQuote({ status: "ready", maxFee: fee });
  }, []);

  return { quote, refresh, accept };
};
