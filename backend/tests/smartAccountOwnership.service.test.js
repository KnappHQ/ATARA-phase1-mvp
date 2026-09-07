const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const { Wallet } = require("ethers");
const {
  assertSmartAccountOwnedBySigner,
  resolveExpectedSmartAccountAddress,
} = require("../services/smartAccountOwnership.service.ts");

const jsonResponse = (payload, ok = true) => ({
  ok,
  async json() {
    return payload;
  },
});

test("resolves the Alchemy smart account for the authenticated signer", async () => {
  const signer = Wallet.createRandom();
  const smartAccount = Wallet.createRandom().address;
  let request;

  const resolved = await resolveExpectedSmartAccountAddress(signer.address, {
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ result: { accountAddress: smartAccount } });
    },
  });

  assert.equal(resolved, smartAccount.toLowerCase());
  assert.equal(request.url, "https://api.g.alchemy.com/v2/test-key");

  const body = JSON.parse(request.options.body);
  assert.equal(body.method, "wallet_requestAccount");
  assert.equal(body.params[0].signerAddress, signer.address.toLowerCase());
  assert.deepEqual(body.params[0].creationHint, { accountType: "sma-b" });
});

test("accepts the supplied smart account only when Alchemy resolves the same address", async () => {
  const signer = Wallet.createRandom();
  const smartAccount = Wallet.createRandom().address;

  await assert.doesNotReject(() =>
    assertSmartAccountOwnedBySigner(signer.address, smartAccount, {
      apiKey: "test-key",
      fetchImpl: async () =>
        jsonResponse({ result: { accountAddress: smartAccount.toLowerCase() } }),
    }),
  );
});

test("rejects a smart account that belongs to a different signer mapping", async () => {
  const signer = Wallet.createRandom();
  const supplied = Wallet.createRandom().address;
  const expected = Wallet.createRandom().address;

  await assert.rejects(
    () =>
      assertSmartAccountOwnedBySigner(signer.address, supplied, {
        apiKey: "test-key",
        fetchImpl: async () =>
          jsonResponse({ result: { accountAddress: expected } }),
      }),
    /Smart account does not belong to the authenticated wallet/,
  );
});

test("fails closed when server-side Alchemy verification is unavailable", async () => {
  const signer = Wallet.createRandom();

  await assert.rejects(
    () =>
      resolveExpectedSmartAccountAddress(signer.address, {
        apiKey: "test-key",
        fetchImpl: async () => {
          throw new Error("network unavailable");
        },
      }),
    /Unable to verify smart account ownership right now/,
  );
});
