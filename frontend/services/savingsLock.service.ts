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
import { VAULT_RPC_URL } from "@/utils/vaultConfig";
import { isSavingsConfigured, SAVINGS_LOCK_FACTORY_ADDRESS } from "@/utils/savingsConfig";
import factoryAbiJson from "@/contracts/AtaraSavingsLockFactory.json";
import lockAbiJson from "@/contracts/AtaraSavingsLock.json";

const factoryAbi = factoryAbiJson as Abi;
const lockAbi = lockAbiJson as Abi;
const tokenAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const satisfies Abi;

const client = createPublicClient({ chain: baseSepolia, transport: http(VAULT_RPC_URL) });
const asAddress = (value: string) => value as Address;

export type SavingsLockSnapshot = {
  name: string;
  owner: string;
  unlockAt: number;
  chainTimestamp: number;
  balance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  maxTotalDeposits: string;
};

const assertConfigured = () => {
  if (!isSavingsConfigured) throw new Error("Savings locks are not configured on Base Sepolia yet.");
};

const encodeLock = (functionName: string, args: readonly unknown[] = []): Hex =>
  encodeFunctionData({ abi: lockAbi, functionName: functionName as never, args: args as never }) as Hex;

const encodeFactory = (name: string, args: readonly unknown[]): Hex =>
  encodeFunctionData({ abi: factoryAbi, functionName: name as never, args: args as never }) as Hex;

export const SavingsLockService = {
  isConfigured: () => isSavingsConfigured,

  async getLocks(owner: string): Promise<string[]> {
    assertConfigured();
    const result = await client.readContract({
      address: asAddress(SAVINGS_LOCK_FACTORY_ADDRESS),
      abi: factoryAbi,
      functionName: "getSavingsLocks",
      args: [asAddress(owner), 0n, 20n],
    }) as readonly [readonly Address[], bigint];
    return [...result[0]];
  },

  async getSnapshot(lock: string): Promise<SavingsLockSnapshot> {
    assertConfigured();
    const raw = await client.readContract({
      address: asAddress(lock), abi: lockAbi, functionName: "snapshot",
    }) as any;
    return {
      name: raw.name,
      owner: raw.owner,
      unlockAt: Number(raw.unlockAt),
      chainTimestamp: Number(raw.chainTimestamp),
      balance: raw.balance.toString(),
      totalDeposited: raw.totalDeposited.toString(),
      totalWithdrawn: raw.totalWithdrawn.toString(),
      maxTotalDeposits: raw.maxTotalDeposits.toString(),
    };
  },

  createLockCall: (name: string, unlockAt: number): { target: Address; data: Hex } => {
    assertConfigured();
    const salt = keccak256(stringToHex(`${name}:${unlockAt}:${Date.now()}`));
    return { target: asAddress(SAVINGS_LOCK_FACTORY_ADDRESS), data: encodeFactory("createSavingsLock", [name, BigInt(unlockAt), salt]) };
  },

  depositCalls: (lock: string, amount: string, depositId: Hex) => {
    const token = asAddress(getTokenAddress("USDC", APP_NETWORK));
    const rawAmount = parseUnits(amount, 6);
    return [
      { target: token, data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [asAddress(lock), 0n] }) as Hex },
      { target: token, data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [asAddress(lock), rawAmount] }) as Hex },
      { target: asAddress(lock), data: encodeLock("deposit", [rawAmount, depositId]) },
    ];
  },

  withdrawCall: (lock: string, recipient: string, amount: string) => ({
    target: asAddress(lock),
    data: encodeLock("withdraw", [asAddress(recipient), parseUnits(amount, 6)]),
  }),
};
