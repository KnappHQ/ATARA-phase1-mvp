export type ParsedPaymentRequest = {
  address: string;
  amount?: string;
  amountInBaseUnits?: string;
  symbol?: string;
  tokenAddress?: string;
  chainId?: number;
};

const INTEGER_PATTERN = /^\d+$/;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d*)?$/;

export const normalizeDecimalAmount = (value: string): string | null => {
  const normalized = value.trim().replace(",", ".");
  if (!DECIMAL_PATTERN.test(normalized)) return null;

  const [whole, fraction] = normalized.split(".");
  return fraction ? `${whole}.${fraction}` : whole;
};

export const decimalToBaseUnits = (
  value: string,
  decimals: number,
): bigint | null => {
  const normalized = normalizeDecimalAmount(value);
  if (!normalized || !Number.isInteger(decimals) || decimals < 0) return null;

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) return null;

  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction || "0").padEnd(decimals, "0"))
  );
};

export const baseUnitsToDecimal = (
  value: string,
  decimals: number,
): string | null => {
  if (!INTEGER_PATTERN.test(value) || !Number.isInteger(decimals) || decimals < 0) {
    return null;
  }

  if (decimals === 0) return BigInt(value).toString();
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${BigInt(whole)}.${fraction}` : BigInt(whole).toString();
};

const parseChainId = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const parsePaymentRequest = (value: string): ParsedPaymentRequest | null => {
  const raw = value.trim();
  if (!raw) return null;

  try {
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        address: typeof parsed.address === "string" ? parsed.address : "",
        amount:
          typeof parsed.amount === "string" || typeof parsed.amount === "number"
            ? String(parsed.amount)
            : undefined,
        symbol:
          typeof parsed.token === "string"
            ? parsed.token
            : typeof parsed.symbol === "string"
              ? parsed.symbol
              : undefined,
        tokenAddress:
          typeof parsed.tokenAddress === "string"
            ? parsed.tokenAddress
            : undefined,
        chainId:
          typeof parsed.chainId === "string" || typeof parsed.chainId === "number"
            ? parseChainId(String(parsed.chainId))
            : undefined,
      };
    }

    const normalized = raw.replace(/^ethereum:/i, "");
    const [targetAndFunction, query = ""] = normalized.split("?", 2);
    const [targetAndChain, functionName] = targetAndFunction.split("/", 2);
    const [target, chain] = targetAndChain.split("@", 2);
    const params = new URLSearchParams(query);

    if (functionName?.toLowerCase() === "transfer") {
      return {
        address: params.get("address") || "",
        amountInBaseUnits: params.get("uint256") || undefined,
        symbol: params.get("token") || params.get("symbol") || undefined,
        tokenAddress: target,
        chainId: parseChainId(chain),
      };
    }

    return {
      address: target,
      amountInBaseUnits: params.get("value") || undefined,
      amount: params.get("amount") || undefined,
      symbol: params.get("token") || params.get("symbol") || undefined,
      chainId: parseChainId(chain),
    };
  } catch {
    return null;
  }
};
