const assert = require("node:assert/strict");
const test = require("node:test");
const { checkRelease } = require("./release-preflight.cjs");

const betaEnv = {
  EXPO_PUBLIC_API_URL: "https://atara-api-8ne3.onrender.com",
  EXPO_PUBLIC_PRIVY_APP_ID: "privy-app",
  EXPO_PUBLIC_PRIVY_CLIENT_ID: "privy-client",
  EXPO_PUBLIC_ALCHEMY_API_KEY: "alchemy-key",
  EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID: "gas-policy",
  EXPO_PUBLIC_DEMO_MODE: "false",
  EXPO_PUBLIC_NETWORK: "base-sepolia",
};

test("accepts a Base Sepolia beta without a Vault deployment", () => {
  assert.deepEqual(checkRelease(betaEnv, "beta"), []);
});

test("rejects missing credentials and an unsafe API URL", () => {
  const failures = checkRelease(
    {
      EXPO_PUBLIC_API_URL: "http://localhost:3000?token=secret",
      EXPO_PUBLIC_DEMO_MODE: "true",
      EXPO_PUBLIC_NETWORK: "base-mainnet",
    },
    "beta",
  );
  assert.ok(failures.some((failure) => failure.includes("HTTPS API")));
  assert.ok(failures.some((failure) => failure.includes("PRIVY_APP_ID")));
  assert.ok(failures.some((failure) => failure.includes("base-sepolia")));
});

test("blocks public production until release evidence is complete", () => {
  const failures = checkRelease(
    { ...betaEnv, EXPO_PUBLIC_NETWORK: "base-mainnet" },
    "production",
  );
  assert.ok(failures.some((failure) => failure.includes("mainnet release")));
});

test("validates optional sovereignty providers when configured", () => {
  const failures = checkRelease(
    {
      ...betaEnv,
      EXPO_PUBLIC_PASSKEY_RP_ID: "https://atara.finance",
      EXPO_PUBLIC_REOWN_PROJECT_ID: "not-a-project-id",
      EXPO_PUBLIC_SOURCE_URL: "http://example.test/source",
    },
    "beta",
  );
  assert.ok(failures.some((failure) => failure.includes("PASSKEY_RP_ID")));
  assert.ok(failures.some((failure) => failure.includes("REOWN_PROJECT_ID")));
  assert.ok(failures.some((failure) => failure.includes("SOURCE_URL")));
});
