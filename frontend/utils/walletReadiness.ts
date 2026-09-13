/** Wait for the React wallet hook to publish the newly created signer. */
export async function waitForWallet<T extends { address: string }>(
  readWallets: () => readonly T[],
  address: string,
  signal: AbortSignal,
  timeoutMs = 15000,
  intervalMs = 100,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    assertActive(signal);
    const wallet = readWallets().find(
      (candidate) => candidate.address.toLowerCase() === address.toLowerCase(),
    );
    if (wallet) return wallet;
    if (Date.now() >= deadline) {
      throw new Error("Wallet setup is taking too long. Please retry or go back to sign-in.");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Account setup cancelled.");
}
