import { ethers } from "ethers";
import factoryAbi from "../contracts/AtaraVaultFactory.json";
import vaultAbi from "../contracts/AtaraGroupVault.json";
import {
  VAULT_CHAIN_ID,
  VAULT_FACTORY_ADDRESS,
  VAULT_RPC_URL,
} from "../utils/constants";
import { ErrorHandler } from "../utils/errorHandler";

const provider = new ethers.providers.JsonRpcProvider(VAULT_RPC_URL);

const requireConfigured = () => {
  if (!ethers.utils.isAddress(VAULT_FACTORY_ADDRESS)) {
    throw new ErrorHandler("Vaults are not configured for this environment yet", 503);
  }
};

const assertSepolia = async () => {
  const network = await provider.getNetwork();
  if (network.chainId !== VAULT_CHAIN_ID) {
    throw new ErrorHandler("Vault RPC is connected to the wrong network", 503);
  }
};

const normalizeSnapshot = (raw: any) => ({
  name: raw.name,
  unlockAt: Number(raw.unlockAt.toString()),
  chainTimestamp: Number(raw.chainTimestamp.toString()),
  balance: raw.balance.toString(),
  totalDeposited: raw.totalDeposited.toString(),
  maxTotalDeposits: raw.maxTotalDeposits.toString(),
  acceptedCount: Number(raw.acceptedCount.toString()),
  proposalId: Number(raw.proposalId.toString()),
  cancellationApprovalCount: Number(raw.cancellationApprovalCount.toString()),
  cancelled: raw.cancelled,
  members: raw.members.map((member: string, index: number) => ({
    address: member,
    accepted: raw.accepted[index],
    contribution: raw.contributions[index].toString(),
    approved: raw.approvals[index],
    cancellationApproved: raw.cancellationApprovals[index],
  })),
  proposal: {
    recipient: raw.proposal.recipient,
    amount: raw.proposal.amount.toString(),
    expiresAt: Number(raw.proposal.expiresAt.toString()),
    approvalCount: Number(raw.proposal.approvalCount.toString()),
    executed: raw.proposal.executed,
    cancelled: raw.proposal.cancelled,
  },
});

export const vaultService = {
  getVaults: async (member: string, offset = 0, limit = 20) => {
    requireConfigured();
    if (!ethers.utils.isAddress(member)) throw new ErrorHandler("Invalid member address", 400);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new ErrorHandler("Invalid vault pagination", 400);
    }
    await assertSepolia();
    const factory = new ethers.Contract(VAULT_FACTORY_ADDRESS, factoryAbi, provider);
    const [vaults, total] = await factory.getVaults(member, offset, limit);
    return { vaults, total: total.toNumber() };
  },

  getSnapshot: async (vaultAddress: string, member: string) => {
    requireConfigured();
    if (!ethers.utils.isAddress(vaultAddress) || !ethers.utils.isAddress(member)) {
      throw new ErrorHandler("Invalid vault address", 400);
    }
    await assertSepolia();
    const factory = new ethers.Contract(VAULT_FACTORY_ADDRESS, factoryAbi, provider);
    if (!(await factory.isVault(vaultAddress))) throw new ErrorHandler("Vault not found", 404);
    const vault = new ethers.Contract(vaultAddress, vaultAbi, provider);
    if (!(await vault.isMember(member))) throw new ErrorHandler("Only vault members can view this vault", 403);
    return normalizeSnapshot(await vault.snapshot());
  },
};
