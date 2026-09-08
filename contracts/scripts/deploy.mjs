import fs from "node:fs";
import { Contract, ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const provider = new JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
if (!process.env.BASE_SEPOLIA_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("Set BASE_SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY in contracts/.env");
}
if ((await provider.getNetwork()).chainId !== 84532n) throw new Error("Vault beta can only deploy on Base Sepolia");
// Circle's Base Sepolia USDC. Never substitute a mainnet token.
const tokenAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const token = new Contract(tokenAddress, ["function decimals() view returns(uint8)"], provider);
if (await token.decimals() !== 6n) throw new Error("Unexpected token decimals");
const artifact = JSON.parse(fs.readFileSync(new URL("../artifacts/AtaraVaultFactory.json", import.meta.url), "utf8"));
const factory = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)).deploy(tokenAddress);
const receipt = await factory.deploymentTransaction().wait(2);
const address = await factory.getAddress();
const manifest = { chainId: 84532, factory: address, token: tokenAddress, transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
fs.mkdirSync(new URL("../deployments/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`../deployments/${address}.json`, import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
console.log(`Set VAULT_FACTORY_ADDRESS=${address} on the backend and EXPO_PUBLIC_VAULT_FACTORY_ADDRESS=${address} in the Sepolia build.`);
