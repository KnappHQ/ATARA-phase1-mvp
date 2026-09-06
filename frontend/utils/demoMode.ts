import type { VaultSnapshot } from "@/services/vault.service";

/**
 * Safe, frontend-only preview mode. It never calls the API or a wallet.
 * Enable it with EXPO_PUBLIC_DEMO_MODE=true in the Expo environment.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "true";

export const DEMO_VAULT_ADDRESS = "0x1111111111111111111111111111111111111111";
export const DEMO_MEMBER_ADDRESS = "0x2222222222222222222222222222222222222222";
const SECOND_MEMBER_ADDRESS = "0x3333333333333333333333333333333333333333";
const THIRD_MEMBER_ADDRESS = "0x4444444444444444444444444444444444444444";

export const DEMO_VAULT_CONTACTS = [
  { handle: "@marcuschen", name: "Marcus Chen", address: SECOND_MEMBER_ADDRESS },
  { handle: "@elenarodriguez", name: "Elena Rodriguez", address: THIRD_MEMBER_ADDRESS },
].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));

const isHexAddress = (value?: string): value is `0x${string}` =>
  !!value && /^0x[a-fA-F0-9]{40}$/.test(value);

export const getDemoVaultSnapshot = (account?: string): VaultSnapshot => {
  const firstMember = isHexAddress(account) ? account.toLowerCase() : DEMO_MEMBER_ADDRESS;
  const members = [...new Set([firstMember, SECOND_MEMBER_ADDRESS, THIRD_MEMBER_ADDRESS])];
  const now = Math.floor(Date.now() / 1000);
  const oneHundredTwentyFiveUsdc = "125000000";

  return {
    name: "Cagnotte vacances (simulation)",
    unlockAt: now + 14 * 24 * 60 * 60,
    chainTimestamp: now,
    balance: oneHundredTwentyFiveUsdc,
    totalDeposited: oneHundredTwentyFiveUsdc,
    maxTotalDeposits: "10000000000",
    acceptedCount: members.length,
    proposalId: 0,
    cancellationApprovalCount: 0,
    cancelled: false,
    members: members.map((address, index) => ({
      address,
      accepted: true,
      contribution: index === 0 ? "50000000" : index === 1 ? "45000000" : "30000000",
      approved: false,
      cancellationApproved: false,
    })),
    proposal: {
      recipient: "0x0000000000000000000000000000000000000000",
      amount: "0",
      expiresAt: 0,
      approvalCount: 0,
      executed: false,
      cancelled: false,
    },
  };
};
