import {
  createPublicClient,
  encodeFunctionData,
  http,
  keccak256,
  parseUnits,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { APP_NETWORK } from "@/utils/constants";
import { getTokenAddress } from "@/utils/tokenConfig";
import { isVaultConfigured, VAULT_FACTORY_ADDRESS, VAULT_RPC_URL } from "@/utils/vaultConfig";
import factoryAbiJson from "@/contracts/AtaraVaultFactory.json";
import vaultAbiJson from "@/contracts/AtaraGroupVault.json";

const factoryAbi = factoryAbiJson as Abi;
const vaultAbi = vaultAbiJson as Abi;
const tokenAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const satisfies Abi;

const client = createPublicClient({ chain: baseSepolia, transport: http(VAULT_RPC_URL) });
const asAddress = (value: string) => value as Address;

type VaultMember = {
  address: string;
  accepted: boolean;
  contribution: string;
  approved: boolean;
  cancellationApproved: boolean;
};

export type VaultSnapshot = {
  name: string;
  unlockAt: number;
  chainTimestamp: number;
  balance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  maxTotalDeposits: string;
  acceptedCount: number;
  proposalId: number;
  cancellationApprovalCount: number;
  cancelled: boolean;
  members: VaultMember[];
  proposal: {
    recipient: string;
    amount: string;
    expiresAt: number;
    approvalCount: number;
    executed: boolean;
    cancelled: boolean;
  };
};

const assertConfigured = () => {
  if (!isVaultConfigured) throw new Error("Vaults are not configured on Base Sepolia yet.");
};

const encodeVault = (functionName: string, args: readonly unknown[] = []): Hex =>
  encodeFunctionData({ abi: vaultAbi, functionName: functionName as never, args: args as never }) as Hex;

const encodeFactory = (name: string, args: readonly unknown[]): Hex =>
  encodeFunctionData({ abi: factoryAbi, functionName: name as never, args: args as never }) as Hex;

export const VaultService = {
  isConfigured: () => isVaultConfigured,

  async getVaults(member: string): Promise<string[]> {
    assertConfigured();
    const result = await client.readContract({
      address: asAddress(VAULT_FACTORY_ADDRESS),
      abi: factoryAbi,
      functionName: "getVaults",
      args: [asAddress(member), 0n, 20n],
    }) as readonly [readonly Address[], bigint];
    return [...result[0]];
  },

  async getSnapshot(vault: string): Promise<VaultSnapshot> {
    assertConfigured();
    const raw = await client.readContract({
      address: asAddress(vault), abi: vaultAbi, functionName: "snapshot",
    }) as any;
    return {
      name: raw.name,
      unlockAt: Number(raw.unlockAt),
      chainTimestamp: Number(raw.chainTimestamp),
      balance: raw.balance.toString(),
      totalDeposited: raw.totalDeposited.toString(),
      totalWithdrawn: raw.totalWithdrawn.toString(),
      maxTotalDeposits: raw.maxTotalDeposits.toString(),
      acceptedCount: Number(raw.acceptedCount),
      proposalId: Number(raw.proposalId),
      cancellationApprovalCount: Number(raw.cancellationApprovalCount),
      cancelled: Boolean(raw.cancelled),
      members: raw.members.map((address: string, index: number) => ({
        address,
        accepted: raw.accepted[index],
        contribution: raw.contributions[index].toString(),
        approved: raw.approvals[index],
        cancellationApproved: raw.cancellationApprovals[index],
      })),
      proposal: {
        recipient: raw.proposal.recipient,
        amount: raw.proposal.amount.toString(),
        expiresAt: Number(raw.proposal.expiresAt),
        approvalCount: Number(raw.proposal.approvalCount),
        executed: raw.proposal.executed,
        cancelled: raw.proposal.cancelled,
      },
    };
  },

  createVaultCall: (name: string, members: string[], unlockAt: number): { target: Address; data: Hex } => {
    assertConfigured();
    const salt = keccak256(stringToHex(`${name}:${members.join(",")}:${unlockAt}:${Date.now()}`));
    return { target: asAddress(VAULT_FACTORY_ADDRESS), data: encodeFactory("createVault", [name, members.map(asAddress), BigInt(unlockAt), salt]) };
  },

  acceptCall: (vault: string) => ({ target: asAddress(vault), data: encodeVault("acceptTerms") }),

  depositCalls: (vault: string, amount: string, depositId: Hex) => {
    const token = asAddress(getTokenAddress("USDC", APP_NETWORK));
    const rawAmount = parseUnits(amount, 6);
    return [
      { target: token, data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [asAddress(vault), 0n] }) as Hex },
      { target: token, data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [asAddress(vault), rawAmount] }) as Hex },
      { target: asAddress(vault), data: encodeVault("deposit", [rawAmount, depositId]) },
    ];
  },

  proposeCall: (vault: string, recipient: string, amount: string, nextId: number) => ({ target: asAddress(vault), data: encodeVault("proposeWithdrawal", [asAddress(recipient), parseUnits(amount, 6), BigInt(nextId)]) }),
  approvalCall: (vault: string, proposalId: number, approve: boolean) => ({ target: asAddress(vault), data: encodeVault("setApproval", [BigInt(proposalId), approve]) }),
  cancelCall: (vault: string, proposalId: number) => ({ target: asAddress(vault), data: encodeVault("cancelProposal", [BigInt(proposalId)]) }),
  executeCall: (vault: string, proposalId: number) => ({ target: asAddress(vault), data: encodeVault("executeWithdrawal", [BigInt(proposalId)]) }),
  cancellationApprovalCall: (vault: string, approve: boolean) => ({ target: asAddress(vault), data: encodeVault("setCancellationApproval", [approve]) }),
  cancelVaultCall: (vault: string) => ({ target: asAddress(vault), data: encodeVault("cancelVault") }),
};
