const assert = require("node:assert/strict");
const test = require("node:test");
const { checkRelease, resolveProfileEnv } = require("./release-preflight.cjs");

const betaEnv = {
  EXPO_PUBLIC_API_URL: "https://atara-api-8ne3.onrender.com",
  EXPO_PUBLIC_PRIVY_APP_ID: "privy-app",
  EXPO_PUBLIC_PRIVY_CLIENT_ID: "privy-client",
  EXPO_PUBLIC_ALCHEMY_API_KEY: "alchemy-key",
  EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID: "gas-policy",
  EXPO_PUBLIC_DEMO_MODE: "false",
  EXPO_PUBLIC_ENABLE_VAULTS: "false",
  EXPO_PUBLIC_PASSKEY_RP_ID: "api.atara.finance",
  EXPO_PUBLIC_REOWN_PROJECT_ID: "0123456789abcdef0123456789abcdef",
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
  assert.ok(failures.some((failure) => failure.includes("REOWN_PROJECT_ID")));
  assert.ok(failures.some((failure) => failure.includes("PASSKEY_RP_ID")));
  assert.ok(failures.some((failure) => failure.includes("ENABLE_VAULTS")));
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


test("build-profile env overrides stale EAS project values", () => {
  const eas = {
    build: {
      beta: {
        env: {
          EXPO_PUBLIC_PRIVY_APP_ID: "cmqmg9qss00580cl48pp5enxs",
          EXPO_PUBLIC_PRIVY_CLIENT_ID:
            "client-WY6aSvC1vAstj49sRqJe2L6YHDaety8D8z5fHQrrJAJuo",
          EXPO_PUBLIC_ENABLE_VAULTS: "false",
          EXPO_PUBLIC_REOWN_PROJECT_ID: "35f77053ffe4f0ebcb92abbdd81e8d55",
        },
      },
    },
  };
  const effective = {
    EXPO_PUBLIC_PRIVY_APP_ID: "stale-same-id",
    EXPO_PUBLIC_PRIVY_CLIENT_ID: "stale-same-id",
    ...resolveProfileEnv(eas, "beta"),
  };

  assert.equal(
    effective.EXPO_PUBLIC_PRIVY_APP_ID,
    "cmqmg9qss00580cl48pp5enxs",
  );
  assert.equal(
    effective.EXPO_PUBLIC_PRIVY_CLIENT_ID,
    "client-WY6aSvC1vAstj49sRqJe2L6YHDaety8D8z5fHQrrJAJuo",
  );
  assert.equal(effective.EXPO_PUBLIC_ENABLE_VAULTS, "false");
  assert.equal(
    effective.EXPO_PUBLIC_REOWN_PROJECT_ID,
    "35f77053ffe4f0ebcb92abbdd81e8d55",
  );
});

test("preview inherits beta build-profile env", () => {
  const eas = {
    build: {
      beta: {
        env: {
          EXPO_PUBLIC_ENABLE_VAULTS: "false",
          EXPO_PUBLIC_REOWN_PROJECT_ID: "0123456789abcdef0123456789abcdef",
        },
      },
      preview: {
        extends: "beta",
        env: { EXPO_PUBLIC_DEMO_MODE: "false" },
      },
    },
  };

  assert.deepEqual(resolveProfileEnv(eas, "preview"), {
    EXPO_PUBLIC_ENABLE_VAULTS: "false",
    EXPO_PUBLIC_REOWN_PROJECT_ID: "0123456789abcdef0123456789abcdef",
    EXPO_PUBLIC_DEMO_MODE: "false",
  });
});
