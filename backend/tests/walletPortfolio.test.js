const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const axios = require("axios");
const { ethers } = require("ethers");
const prisma = require("../config/prisma.ts").default;

// Alchemy's RPC URL embeds the API key, and provider errors quote the URL.
const SECRET = "ALCHEMY-SECRET-KEY-123";
const providerFailure = () =>
  Promise.reject(
    new Error(`missing response (url="https://base-sepolia.g.alchemy.com/v2/${SECRET}")`),
  );

const stub = (object, key, value) => {
  const original = object[key];
  object[key] = value;
  return () => {
    object[key] = original;
  };
};

const { walletService } = require("../services/wallet.service.ts");

const withStubs = async (stubs, run) => {
  const restores = stubs.map(([object, key, value]) => stub(object, key, value));
  try {
    return await run();
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
};

const user = { smartAccountAddress: "0x1111111111111111111111111111111111111111" };
const noPrices = async () => ({ data: { data: [] } });

test("a failed balance read answers 503 instead of an empty wallet", async () => {
  await withStubs(
    [
      [prisma.user, "findUnique", async () => user],
      [ethers.providers.JsonRpcProvider.prototype, "getBalance", providerFailure],
      [axios, "post", async () => ({ data: { result: { tokenBalances: [] } } })],
      [axios, "get", noPrices],
    ],
    async () => {
      await assert.rejects(walletService.getUserPortfolio("user-1"), (error) => {
        assert.equal(error.statusCode, 503);
        assert.ok(!error.message.includes(SECRET), "the provider's URL, and its key, must not reach the client");
        return true;
      });
    },
  );
});

test("a failed token balance read is not turned into zero", async () => {
  await withStubs(
    [
      [prisma.user, "findUnique", async () => user],
      [ethers.providers.JsonRpcProvider.prototype, "getBalance", async () => ethers.BigNumber.from(0)],
      [axios, "post", async () => ({ data: { error: { message: `boom ${SECRET}` } } })],
      [axios, "get", noPrices],
    ],
    async () => {
      await assert.rejects(walletService.getUserPortfolio("user-1"), (error) => {
        assert.equal(error.statusCode, 503);
        assert.ok(!error.message.includes(SECRET));
        return true;
      });
    },
  );
});

test("a successful read still reports the real balances", async () => {
  await withStubs(
    [
      [prisma.user, "findUnique", async () => user],
      [ethers.providers.JsonRpcProvider.prototype, "getBalance", async () => ethers.utils.parseEther("0.5")],
      [axios, "post", async () => ({ data: { result: { tokenBalances: [] } } })],
      [axios, "get", noPrices],
    ],
    async () => {
      const portfolio = await walletService.getUserPortfolio("user-1");
      const eth = portfolio.tokens.find((token) => token.symbol === "ETH");
      assert.equal(eth.balance, "0.500000");
    },
  );
});
