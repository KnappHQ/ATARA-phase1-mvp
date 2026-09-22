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
    if (signal.aborted) throw new Error("Connexion wallet annulée.");
    const state = read();
    if (state.isConnected && state.hasProvider) return;
    if (wasOpen && !state.isOpen && !state.isConnected) {
      throw new Error("Connexion wallet annulée.");
    }
    wasOpen ||= state.isOpen;
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  throw new Error("Le wallet n’a pas répondu. Vérifie ton application wallet et réessaie.");
}
