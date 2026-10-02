/**
 * What deleting the ATARA account leaves behind, so the person is told before
 * they confirm.
 *
 * Deleting the profile removes what ATARA's server holds about them. It does
 * not touch the blockchain and it does not touch the sign-in methods (Privy
 * keeps the passkeys and the wallet, iOS keeps its passkey entries). So funds
 * sitting at the address stay reachable, and only by signing in again with a
 * passkey or account of this wallet: an acknowledgement is asked for whenever
 * there are, or may be, funds.
 */

export interface AssetLike {
  symbol: string;
  balance?: string | number | null;
}

export type FundsStatus =
  | { status: "empty" }
  | { status: "funds"; summary: string }
  | { status: "unknown" };

/**
 * `unknown` when the balance could not be read: an unreadable balance is not
 * an empty one, and must not let the confirmation skip its warning.
 *
 * `source` is where the wallet store says the balances came from. `null` means
 * nothing has been read yet, and the zeros then on screen are placeholders.
 */
export const describeFunds = (
  assets: readonly AssetLike[],
  balanceError?: string | null,
  isLoading = false,
  source?: string | null,
): FundsStatus => {
  if (balanceError || isLoading || source === null || assets.length === 0) return { status: "unknown" };

  const held = assets.filter((asset) => {
    const amount = Number(asset.balance);
    return Number.isFinite(amount) && amount > 0;
  });
  if (assets.some((asset) => !Number.isFinite(Number(asset.balance ?? 0)))) return { status: "unknown" };
  if (held.length === 0) return { status: "empty" };

  return {
    status: "funds",
    summary: held.map((asset) => `${Number(asset.balance)} ${asset.symbol}`).join(", "),
  };
};
