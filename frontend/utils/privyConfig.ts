/**
 * The embedded-wallet policy shared by the Privy provider and by the passkey
 * sign-in that ATARA runs itself. One definition: a wallet is created at login
 * only for users who have none, exactly as the SDK's own hook would do.
 */
export const embeddedWalletConfig = {
  ethereum: {
    createOnLogin: "users-without-wallets",
  },
} as const;
