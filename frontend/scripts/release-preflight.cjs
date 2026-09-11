const fs = require("node:fs");
const path = require("node:path");
function checkRelease(env, profile) {
  if (!["beta", "preview", "production"].includes(profile)) return [];
  const failures = [];
  for (const key of [
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_PRIVY_APP_ID",
    "EXPO_PUBLIC_PRIVY_CLIENT_ID",
    "EXPO_PUBLIC_ALCHEMY_API_KEY",
    "EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID",
  ]) {
    if (!env[key]?.trim())
      failures.push(`${key} is missing from the EAS environment.`);
  }

  const privyAppId = env.EXPO_PUBLIC_PRIVY_APP_ID?.trim();
  const privyClientId = env.EXPO_PUBLIC_PRIVY_CLIENT_ID?.trim();
  if (privyAppId && privyClientId && privyAppId === privyClientId)
    failures.push(
      "Privy App ID and mobile App Client ID must be different values.",
    );
  for (const [name, value] of [
    ["EXPO_PUBLIC_PRIVY_APP_ID", privyAppId],
    ["EXPO_PUBLIC_PRIVY_CLIENT_ID", privyClientId],
  ]) {
    if (value && /^(your-|replace-|changeme|example)/i.test(value))
      failures.push(`${name} still contains a placeholder value.`);
  }

  try {
    const url = new URL(env.EXPO_PUBLIC_API_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      throw Error();
  } catch {
    failures.push("A public HTTPS API URL without credentials is required.");
  }
  if (env.EXPO_PUBLIC_DEMO_MODE !== "false")
    failures.push("Distributed builds require EXPO_PUBLIC_DEMO_MODE=false.");
  if (["beta", "preview"].includes(profile) && env.EXPO_PUBLIC_ENABLE_VAULTS !== "false")
    failures.push("Beta builds must keep EXPO_PUBLIC_ENABLE_VAULTS=false until the Vault release is explicitly approved.");
  const passkeyRpId = env.EXPO_PUBLIC_PASSKEY_RP_ID?.trim();
  if (["beta", "preview"].includes(profile) && !passkeyRpId)
    failures.push("Beta builds require EXPO_PUBLIC_PASSKEY_RP_ID because passkey is a primary sign-in path.");
  if (passkeyRpId && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(passkeyRpId))
    failures.push("EXPO_PUBLIC_PASSKEY_RP_ID must be a hostname without https://.");
  const reownProjectId = env.EXPO_PUBLIC_REOWN_PROJECT_ID?.trim();
  if (["beta", "preview"].includes(profile) && !reownProjectId)
    failures.push("Beta builds require EXPO_PUBLIC_REOWN_PROJECT_ID so wallet-only sign-in is available.");
  if (reownProjectId && !/^[a-f0-9]{32}$/i.test(reownProjectId))
    failures.push("EXPO_PUBLIC_REOWN_PROJECT_ID must be a 32-character Reown project id.");
  if (env.EXPO_PUBLIC_SOURCE_URL) {
    try {
      const sourceUrl = new URL(env.EXPO_PUBLIC_SOURCE_URL);
      if (sourceUrl.protocol !== "https:") throw Error();
    } catch {
      failures.push("EXPO_PUBLIC_SOURCE_URL must be a public HTTPS URL.");
    }
  }
  const expected = profile === "production" ? "base-mainnet" : "base-sepolia";
  if (env.EXPO_PUBLIC_NETWORK !== expected)
    failures.push(`${profile} requires ${expected}.`);
  const factory = env.EXPO_PUBLIC_VAULT_FACTORY_ADDRESS;
  if (
    factory &&
    (!/^0x[0-9a-f]{40}$/i.test(factory) || /^0x0{40}$/i.test(factory))
  )
    failures.push("Vault factory address is invalid.");
  if (profile === "production")
    failures.push(
      "Public mainnet release remains blocked: see docs/BETA_RELEASE_2026-09-08.md for unresolved device, provider and deployment evidence.",
    );
  return failures;
}
if (require.main === module) {
  const profile =
    process.argv[2] || process.env.EAS_BUILD_PROFILE || "development";
  const app = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app.json")),
  ).expo;
  const failures = checkRelease(process.env, profile);
  if (
    ["beta", "preview", "production"].includes(profile) &&
    (app.owner !== "tk41s-team" ||
      app.extra?.eas?.projectId !== "b454eaa9-f1d5-4d8c-ac09-945ce1f1d09f")
  )
    failures.push("Unexpected ATARA Expo project identity.");
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      `Configuration check passed for ${profile}. Device testing and provider activation remain separate checks.`,
    );
  if (!process.env.EXPO_PUBLIC_VAULT_FACTORY_ADDRESS)
    console.log(
      "Vault deployment is not configured; the app displays its unavailable state.",
    );
}
module.exports = { checkRelease };
