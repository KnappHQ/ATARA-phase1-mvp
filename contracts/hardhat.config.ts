import { defineConfig } from "hardhat/config";

export default defineConfig({
  networks: {
    vaultTest: { type: "edr-simulated", chainType: "l1", chainId: 84532 },
  },
});
