export type WalletConnectionState = {
  isOpen: boolean;
  isConnected: boolean;
  hasProvider: boolean;
};

/** Opening the wallet picker is NOT a completed wallet connection. */
export async function waitForExternalConnection(
  read: () => WalletConnectionState,
  signal: AbortSignal,
  timeoutMs = 90_000,
  pollMs = 100,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let wasOpen = false;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error("Wallet connection canceled.");
    const state = read();
    if (state.isConnected && state.hasProvider) return;
    if (wasOpen && !state.isOpen && !state.isConnected) {
      throw new Error("Wallet connection canceled.");
    }
    wasOpen ||= state.isOpen;
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  throw new Error("The wallet did not respond. Check your wallet app and try again.");
}
