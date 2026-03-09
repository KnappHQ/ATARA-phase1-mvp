import { Contact } from "@/stores/useContactStore";

export const formatCurrency = (
  value: number,
  decimals: number = 2,
  symbol: string = "$",
): string => {
  if (isNaN(value)) return `${symbol}0.00`;

  return `${symbol}${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

export const formatTokenAmount = (
  amount: number | string,
  symbol: string,
  maxDecimals: number = 6,
): string => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) return `0 ${symbol}`;

  if (numAmount < 0.001 && numAmount > 0) {
    return `${numAmount.toFixed(8)} ${symbol}`;
  }

  const truncated = Math.floor(numAmount * 10000) / 10000;

  return `${truncated.toFixed(4)} ${symbol}`;
};

export const calculatePercentageAmount = (
  percentage: string,
  balance: number,
): number => {
  if (percentage === "MAX") return balance;

  const pct = parseInt(percentage.replace("%", ""));
  if (isNaN(pct)) return 0;

  return balance * (pct / 100);
};

export const validateBalance = (
  amount: number,
  balance: number,
): {
  isValid: boolean;
  message?: string;
} => {
  if (amount <= 0) {
    return { isValid: false, message: "Amount must be greater than 0" };
  }

  if (amount > balance) {
    return {
      isValid: false,
      message: "Insufficient balance",
    };
  }

  return { isValid: true };
};

export const parseAmount = (amountStr: string): number => {
  if (!amountStr || amountStr.trim() === "") return 0;

  const cleaned = amountStr.replace(/,/g, "");
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
};

export const formatChange = (
  change: number,
  showSign: boolean = true,
): string => {
  if (isNaN(change)) return "0.00%";

  const sign = change >= 0 ? (showSign ? "+" : "") : "";
  return `${sign}${change.toFixed(2)}%`;
};

export const truncateAddress = (address: string): string => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const formatHistoryAmount = (
  amount: string,
  assetSymbol: string,
  type: "send" | "receive",
): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return `0 ${assetSymbol}`;

  const sign = type === "receive" ? "+" : "-";

  // Smart decimal formatting
  if (num < 0.0001 && num > 0) return `${sign}${num.toFixed(8)} ${assetSymbol}`;
  if (num < 1) return `${sign}${num.toFixed(4)} ${assetSymbol}`;

  return `${sign}${num.toFixed(4)} ${assetSymbol}`;
};

export const buildTransactionName = (
  counterparty: { handle: string | null; address: string },
  isInApp: boolean,
  nickname?: string | null,
): { name: string; showAddress: boolean } => {
  if (isInApp && counterparty.handle) {
    return { name: `@${counterparty.handle}`, showAddress: true };
  }

  if (nickname) {
    return { name: `@${nickname}`, showAddress: true };
  }

  return { name: truncateAddress(counterparty.address), showAddress: false };
};

/**
 * Returns up to 2 uppercase initials from a display name or handle.
 * Strips leading @ from names/handles before extracting characters.
 */
export const getInitials = (
  displayName: string | null,
  handle: string,
): string => {
  const clean = (s: string) => s.replace(/^@/, "").trim();

  if (displayName) {
    const initials = displayName
      .trim()
      .split(" ")
      .map((p) => clean(p)[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2);
    if (initials.length > 0) return initials;
  }

  return clean(handle).slice(0, 2).toUpperCase();
};

export function buildAddressContact(
  address: string,
  nickname?: string,
): Contact {
  const addr = address.trim();
  return {
    id: addr.toLowerCase(),
    handle: nickname || truncateAddress(addr),
    name: nickname || undefined,
    smartAccountAddress: addr,
    isLocalContact: true,
  };
}
