import fs from "node:fs";
import { getAddress } from "ethers";

/**
 * Writes a deployed Vault factory address into the EAS beta build profile.
 *
 * .github/workflows/store-beta.yml refuses to build until
 * `build.beta.env.EXPO_PUBLIC_VAULT_FACTORY_ADDRESS` holds a real address, so
 * this is the step between deploying the factory and being able to ship a store
 * beta at all. Hand-editing the JSON is easy to get subtly wrong - a lowercase
 * address, a stray comma - and the failure only shows up in CI, so it is a
 * command instead.
 *
 * Usage, from contracts/:
 *   node scripts/set-factory-address.mjs 0xYourFactoryAddress
 *
 * The deploying workflow deliberately does not run this: it holds a private key
 * and stays read-only on the repository. Run it locally, review the diff, and
 * open a pull request.
 */

const EAS_PATH = new URL("../../frontend/eas.json", import.meta.url);
const KEY = "EXPO_PUBLIC_VAULT_FACTORY_ADDRESS";
const PROFILE = "beta";

const [, , rawAddress] = process.argv;

if (!rawAddress) {
  console.error("Usage: node scripts/set-factory-address.mjs <factory address>");
  process.exit(1);
}

let address;
try {
  // Checksums the address, and rejects anything that is not one.
  address = getAddress(rawAddress);
} catch {
  console.error(`Not a valid address: ${rawAddress}`);
  process.exit(1);
}

if (/^0x0{40}$/i.test(address)) {
  console.error("Refusing to write the zero address");
  process.exit(1);
}

const eas = JSON.parse(fs.readFileSync(EAS_PATH, "utf8"));
const profile = eas.build?.[PROFILE];

if (!profile) {
  console.error(`No "${PROFILE}" build profile in frontend/eas.json`);
  process.exit(1);
}

const previous = profile.env?.[KEY];
profile.env = { ...profile.env, [KEY]: address };

fs.writeFileSync(EAS_PATH, `${JSON.stringify(eas, null, 2)}\n`);

console.log(
  previous
    ? `Replaced ${KEY}\n  was: ${previous}\n  now: ${address}`
    : `Set ${KEY} = ${address}`,
);
console.log(
  "\nStill to do by hand, because they live outside the repository:\n" +
    `  - VAULT_FACTORY_ADDRESS=${address} on the backend (Render env, marked sync:false)\n` +
    "  - the EAS project variables listed in docs/STORE_BETA_RELEASE_2026-09-07.md",
);
