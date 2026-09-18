import { ethers } from "ethers";
import factoryAbi from "../contracts/AtaraSavingsLockFactory.json";
import lockAbi from "../contracts/AtaraSavingsLock.json";
import {
  SAVINGS_LOCK_FACTORY_ADDRESS,
  VAULT_CHAIN_ID,
  VAULT_RPC_URL,
} from "../utils/constants";
import { ErrorHandler } from "../utils/errorHandler";

const provider = new ethers.providers.JsonRpcProvider(VAULT_RPC_URL);

const requireConfigured = () => {
  if (!ethers.utils.isAddress(SAVINGS_LOCK_FACTORY_ADDRESS)) {
    throw new ErrorHandler("Savings locks are not configured for this environment yet", 503);
  }
};

const assertSepolia = async () => {
  const network = await provider.getNetwork();
  if (network.chainId !== VAULT_CHAIN_ID) {
    throw new ErrorHandler("Savings lock RPC is connected to the wrong network", 503);
  }
};

const normalizeSnapshot = (raw: any) => ({
  name: raw.name,
  owner: raw.owner,
  unlockAt: Number(raw.unlockAt.toString()),
  chainTimestamp: Number(raw.chainTimestamp.toString()),
  balance: raw.balance.toString(),
  totalDeposited: raw.totalDeposited.toString(),
  totalWithdrawn: raw.totalWithdrawn.toString(),
  maxTotalDeposits: raw.maxTotalDeposits.toString(),
});

export const savingsLockService = {
  getLocks: async (owner: string, offset = 0, limit = 20) => {
    requireConfigured();
    if (!ethers.utils.isAddress(owner)) throw new ErrorHandler("Invalid owner address", 400);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new ErrorHandler("Invalid savings lock pagination", 400);
    }
    await assertSepolia();
    const factory = new ethers.Contract(SAVINGS_LOCK_FACTORY_ADDRESS, factoryAbi, provider);
    const [locks, total] = await factory.getSavingsLocks(owner, offset, limit);
    return { locks, total: total.toNumber() };
  },

  getSnapshot: async (lockAddress: string, owner: string) => {
    requireConfigured();
    if (!ethers.utils.isAddress(lockAddress) || !ethers.utils.isAddress(owner)) {
      throw new ErrorHandler("Invalid savings lock address", 400);
    }
    await assertSepolia();
    const factory = new ethers.Contract(SAVINGS_LOCK_FACTORY_ADDRESS, factoryAbi, provider);
    if (!(await factory.isSavingsLock(lockAddress))) {
      throw new ErrorHandler("Savings lock not found", 404);
    }
    const lock = new ethers.Contract(lockAddress, lockAbi, provider);
    // A lock holds one person's money and nobody else has any business reading
    // its balance, so ownership is checked on-chain rather than trusted.
    const onChainOwner: string = await lock.owner();
    if (onChainOwner.toLowerCase() !== owner.toLowerCase()) {
      throw new ErrorHandler("Only the owner can view this savings lock", 403);
    }
    return normalizeSnapshot(await lock.snapshot());
  },
};
