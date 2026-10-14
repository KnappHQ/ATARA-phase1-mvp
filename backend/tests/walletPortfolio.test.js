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

// ---------------------------------------------------------------- prices

const { resetPriceMemory, MAX_STALE_PRICE_AGE_MS, resolveQuote, buildPortfolio } = require("../utils/portfolioPricing.ts");

const read = async ({ eth = "1", usdc = "0", price, historical }) =>
  withStubs(
    [
      [prisma.user, "findUnique", async () => user],
      [ethers.providers.JsonRpcProvider.prototype, "getBalance", async () => ethers.utils.parseEther(eth)],
      [
        axios,
        "post",
        async (url) =>
          String(url).includes("/tokens/historical")
            ? historical(url)
            : {
                data: {
                  result: {
                    tokenBalances: [
                      {
                        contractAddress: require("../utils/tokenConfig.ts").getKnownTokens(require("../utils/constants.ts").NETWORK).USDC.address,
                        tokenBalance: ethers.utils.parseUnits(usdc, 6).toHexString(),
                      },
                    ],
                  },
                },
              },
      ],
      [axios, "get", async (url) => price(url)],
    ],
    () => walletService.getUserPortfolio("user-1"),
  );

test("no price for ETH: the amount stays, the value is unknown, and no 3,000 dollars is invented", async () => {
  resetPriceMemory();
  const portfolio = await read({
    eth: "2",
    price: async () => { throw new Error("price provider down"); },
    historical: async () => { throw new Error("price provider down"); },
  });
  const eth = portfolio.tokens.find((t) => t.symbol === "ETH");
  assert.equal(eth.balance, "2.000000");
  assert.equal(eth.priceStatus, "unavailable");
  assert.equal(eth.priceAsOf, null);
  assert.equal(eth.usdPrice, 0);
  assert.equal(eth.usdValue, 0);
  assert.equal(eth.change24hKnown, false);
  assert.equal(portfolio.totalUSD, 0, "the 6,000 dollars of a made-up price are gone");
  assert.equal(portfolio.valuation.complete, false);
  assert.deepEqual(portfolio.valuation.unpricedSymbols, ["ETH"]);
  assert.equal(portfolio.valuation.change24hKnown, false);
});

test("a real quote is live, dated, and gives a real 24 h change", async () => {
  resetPriceMemory();
  const portfolio = await read({
    eth: "2",
    price: async (url) => ({ data: { data: [{ prices: [{ value: String(url).includes("ETH") ? "2500" : "1" }] }] } }),
    historical: async (url) => ({ data: { data: [{ value: "2000" }] } }),
  });
  const eth = portfolio.tokens.find((t) => t.symbol === "ETH");
  assert.equal(eth.priceStatus, "live");
  assert.ok(Date.parse(eth.priceAsOf) > Date.now() - 60_000);
  assert.equal(eth.usdValue, 5000);
  assert.equal(eth.change24hKnown, true);
  assert.equal(eth.change24h, 1000);
  assert.equal(eth.percentChange24h, 25);
  assert.equal(portfolio.valuation.complete, true);
});

test("a price kept from before is stale with its date, and expires", () => {
  resetPriceMemory();
  const t0 = Date.parse("2026-10-06T10:00:00Z");
  assert.equal(resolveQuote("ETH", 2400, t0).status, "live");
  const stale = resolveQuote("ETH", null, t0 + 60 * 60 * 1000);
  assert.deepEqual(stale, { price: 2400, status: "stale", asOf: "2026-10-06T10:00:00.000Z" });
  const expired = resolveQuote("ETH", null, t0 + MAX_STALE_PRICE_AGE_MS + 1);
  assert.deepEqual(expired, { price: null, status: "unavailable", asOf: null });
});

test("a stablecoin without a quote is an explicit estimate, never a live price", () => {
  resetPriceMemory();
  assert.deepEqual(resolveQuote("USDC", null), { price: 1, status: "pegged_estimate", asOf: null });
  const portfolio = buildPortfolio([
    { symbol: "USDC", name: "USD Coin", amount: 12.5, displayDecimals: 2, decimals: 6, quote: resolveQuote("USDC", null), price24hAgo: null },
  ]);
  assert.equal(portfolio.totalUSD, 12.5);
  assert.deepEqual(portfolio.valuation.estimatedSymbols, ["USDC"]);
  assert.equal(portfolio.valuation.change24hKnown, false, "no real quote, so no 24 h change");
  assert.equal(portfolio.percentChange24h, 0);
});

test("a missing 24 h price makes the change unknown, not zero", () => {
  resetPriceMemory();
  const portfolio = buildPortfolio([
    { symbol: "ETH", name: "Ethereum", amount: 1, displayDecimals: 6, decimals: 18, quote: resolveQuote("ETH", 2500), price24hAgo: null },
  ]);
  assert.equal(portfolio.totalUSD, 2500);
  assert.equal(portfolio.tokens[0].change24hKnown, false);
  assert.equal(portfolio.valuation.change24hKnown, false);
});

test("a token that is not held does not make the total incomplete", () => {
  resetPriceMemory();
  const portfolio = buildPortfolio([
    { symbol: "ETH", name: "Ethereum", amount: 0, displayDecimals: 6, decimals: 18, quote: resolveQuote("ETH", null), price24hAgo: null },
    { symbol: "USDC", name: "USD Coin", amount: 5, displayDecimals: 2, decimals: 6, quote: resolveQuote("USDC", 1), price24hAgo: 1 },
  ]);
  assert.equal(portfolio.valuation.complete, true);
  assert.equal(portfolio.totalUSD, 5);
  assert.equal(portfolio.valuation.change24hKnown, true, "only what is held counts: USDC has both prices");
});
