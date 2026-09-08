import { Contract, JsonRpcProvider, getAddress } from "ethers";

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
const factoryAddress = process.env.VAULT_FACTORY_ADDRESS;
const expectedToken = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

if (!rpcUrl || !factoryAddress) {
  throw new Error("Set BASE_SEPOLIA_RPC_URL and VAULT_FACTORY_ADDRESS before verification");
}

const provider = new JsonRpcProvider(rpcUrl);
const network = await provider.getNetwork();
if (network.chainId !== 84532n) {
  throw new Error(`Expected Base Sepolia chainId 84532, received ${network.chainId}`);
}

const normalizedFactory = getAddress(factoryAddress);
const code = await provider.getCode(normalizedFactory);
if (!code || code === "0x") {
  throw new Error("No contract bytecode found at VAULT_FACTORY_ADDRESS");
}

const factory = new Contract(
  normalizedFactory,
  [
    "function token() view returns(address)",
    "function MAX_TOTAL_DEPOSITS() view returns(uint256)",
  ],
  provider,
);

const [token, cap] = await Promise.all([
  factory.token(),
  factory.MAX_TOTAL_DEPOSITS(),
]);

if (getAddress(token) !== getAddress(expectedToken)) {
  throw new Error(`Factory token mismatch: expected ${expectedToken}, received ${token}`);
}

if (cap !== 10_000n * 1_000_000n) {
  throw new Error(`Unexpected Vault deposit cap: ${cap}`);
}

console.log(JSON.stringify({
  ok: true,
  chainId: Number(network.chainId),
  factory: normalizedFactory,
  token: getAddress(token),
  maxTotalDeposits: cap.toString(),
}, null, 2));
