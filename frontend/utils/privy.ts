import type { User } from "@privy-io/expo";

export const getPrimaryEmbeddedEthereumWalletAddress = (
  user?: User | null,
): string | undefined => {
  const wallet = user?.linked_accounts.find(
    (
      account,
    ): account is Extract<
      User["linked_accounts"][number],
      {
        type: "wallet";
        chain_type: "ethereum";
        connector_type: "embedded";
        wallet_client_type: "privy";
      }
    > =>
      account.type === "wallet" &&
      account.chain_type === "ethereum" &&
      account.connector_type === "embedded" &&
      account.wallet_client_type === "privy",
  );

  return wallet?.address;
};

export const getPrimaryEmailAddress = (
  user?: User | null,
): string | undefined => {
  // First check for direct email account
  const emailAccount = user?.linked_accounts.find(
    (
      account,
    ): account is Extract<User["linked_accounts"][number], { type: "email" }> =>
      account.type === "email",
  );

  if (emailAccount?.address) {
    return emailAccount.address;
  }

  // If no direct email, check OAuth accounts (Google, Apple)
  const oauthAccount = user?.linked_accounts.find(
    (account) =>
      account.type === "google_oauth" || account.type === "apple_oauth",
  ) as any;

  // OAuth accounts have email field at top level
  if (oauthAccount?.email) {
    return oauthAccount.email;
  }

  return undefined;
};

export const getPrimaryOAuthProvider = (
  user?: User | null,
): string | undefined => {
  const provider = user?.linked_accounts.find(
    (account) =>
      account.type === "apple_oauth" || account.type === "google_oauth",
  );

  if (!provider) {
    return undefined;
  }

  return provider.type === "apple_oauth" ? "apple" : "google";
};

