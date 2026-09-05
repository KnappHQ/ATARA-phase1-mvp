import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const root = fileURLToPath(new URL("../", import.meta.url));
const sources = {};
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(filename);
    else if (filename.endsWith(".sol")) sources[path.relative(root, filename)] = { content: fs.readFileSync(filename, "utf8") };
  }
}
collect(path.join(root, "src"));
const input = {
  language: "Solidity", sources,
  settings: {
    optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input), {
  import: (name) => {
    try { return { contents: fs.readFileSync(path.join(root, "node_modules", name), "utf8") }; }
    catch { return { error: `Import not found: ${name}` }; }
  },
}));
for (const diagnostic of output.errors ?? []) console.error(diagnostic.formattedMessage);
if (output.errors?.some((e) => e.severity === "error")) process.exit(1);
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
for (const contracts of Object.values(output.contracts)) {
  for (const [name, artifact] of Object.entries(contracts)) {
    fs.writeFileSync(path.join(root, "artifacts", `${name}.json`), JSON.stringify(artifact, null, 2) + "\n");
    if (!["AtaraGroupVault", "AtaraVaultFactory"].includes(name)) continue;
    const abi = JSON.stringify(artifact.abi, null, 2) + "\n";
    for (const app of ["backend", "frontend"]) {
      const destination = path.join(root, "..", app, "contracts", `${name}.json`);
      if (process.argv.includes("--check")) {
        if (!fs.existsSync(destination) || fs.readFileSync(destination, "utf8") !== abi) throw new Error(`Stale ABI: ${destination}`);
      } else {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, abi);
      }
    }
  }
}
console.log(`Compiled Vault contracts with solc ${solc.version()}`);
