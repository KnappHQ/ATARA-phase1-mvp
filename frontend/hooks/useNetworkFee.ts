import { useCallback, useEffect, useRef, useState } from "react";

import type { SmartAccountService } from "@/services/smartAccount.service";

export type NetworkFeeState = "loading" | "ready" | "unavailable";

export interface NetworkFee {
  state: NetworkFeeState;
  /** The largest fee, in USDC base units. Null unless state is "ready". */
  maxFee: bigint | null;
  retry: () => void;
}

const QUOTE_TIMEOUT_MS = 15_000;

/**
 * The network fee of paying `recipientAddress` in this token, quoted by the
 * wallet provider (nothing is signed or sent). The fee of a transfer does not
 * depend on the amount, so it is quoted once per recipient and token, not on
 * every keystroke. "unavailable" is a real answer: it is never turned into 0.
 */
export const useNetworkFee = (
  service: SmartAccountService | null,
  recipientAddress: string | undefined,
  token: { symbol: string; contractAddress?: string } | undefined,
): NetworkFee => {
  const [result, setResult] = useState<{ key: string; state: NetworkFeeState; maxFee: bigint | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  const symbol = token?.symbol;
  const contractAddress = token?.contractAddress;
  const key = `${service?.address ?? ""}|${recipientAddress ?? ""}|${symbol ?? ""}|${contractAddress ?? ""}|${attempt}`;

  useEffect(() => {
    if (!service || !recipientAddress || !symbol) return;
    const ticket = ++latest.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("fee quote timed out")), QUOTE_TIMEOUT_MS);
    });
    Promise.race([service.estimateFee({ recipientAddress, tokenSymbol: symbol, tokenAddress: contractAddress }), timeout])
      .then((maxFee) => {
        if (ticket === latest.current) setResult({ key, state: "ready", maxFee });
      })
      .catch(() => {
        if (ticket === latest.current) setResult({ key, state: "unavailable", maxFee: null });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      // A newer request supersedes this one; its answer is ignored.
      latest.current++;
      clearTimeout(timer);
    };
  }, [service, recipientAddress, symbol, contractAddress, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // An answer for another recipient or token is not an answer for this one.
  if (!result || result.key !== key) return { state: "loading", maxFee: null, retry };
  return { state: result.state, maxFee: result.maxFee, retry };
};
