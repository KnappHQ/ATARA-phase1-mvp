const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader({ allow: [] });
const { createPaymentOperations } = load("services/paymentOperations.ts");
const { submitAndConfirm } = load("services/paymentSubmission.ts");
const { runExclusiveOperation } = load("utils/exclusiveOperation.ts");
const { parseCallId } = load("utils/callId.ts");

/**
 * The submission code splits the SDK's `sendCalls` into its three requests so
 * that the payment can be stored between "prepared" and "sent". This test runs
 * both against the REAL SDK with a scripted transport and requires the same
 * requests to go out, and the user operation hash read before sending to be the
 * one inside the call id the provider returns.
 */

const USER_OP_HASH = "0xc69e468aa6fafb5c7298c02841e76f976b433018266af39a5807bc29ea9ad392";
const SENDER = "0xa363219d7C0b8673df17529D469Db9eFF0f35D2A";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const RECIPIENT = "0x5999000000000000000000000000000000c0204c";
const CHAIN_ID = 84532;
const CALL_ID = `0x${CHAIN_ID.toString(16).padStart(64, "0")}${USER_OP_HASH.slice(2)}`;
const PREPARED = {
  type: "user-operation-v070",
  data: {
    sender: SENDER,
    nonce: "0x10000000000000000",
    callData: "0x34fcd5be",
    paymaster: "0x3f222Df6aB18C1E10d0Ec136503c3B0dfd929048",
    paymasterData: "0x00",
    paymasterPostOpGasLimit: "0x0",
    paymasterVerificationGasLimit: "0x74d3",
    maxPriorityFeePerGas: "0x60e4b0",
    maxFeePerGas: "0x1bf52290",
    callGasLimit: "0x2bb8",
    verificationGasLimit: "0xc845",
    preVerificationGas: "0x14b74",
  },
  chainId: `0x${CHAIN_ID.toString(16)}`,
  signatureRequest: { type: "personal_sign", data: { raw: USER_OP_HASH }, rawPayload: `0x${"2a".repeat(32)}` },
  feePayment: { sponsored: false, tokenAddress: USDC, maxAmount: "0x4e20" },
  details: { type: "user-operation", data: { hash: USER_OP_HASH, calls: [{ to: USDC, data: "0x", value: "0x0" }] } },
};

const transferData = `0xa9059cbb${RECIPIENT.slice(2).padStart(64, "0")}${(10_000_000n).toString(16).padStart(64, "0")}`;

const build = async () => {
  const { createSmartWalletClient } = await import("@alchemy/wallet-apis");
  const { custom } = await import("viem");
  const { baseSepolia } = await import("viem/chains");
  const { privateKeyToAccount } = await import("viem/accounts");
  const exchange = [];
  const transport = custom({
    request: async ({ method, params }) => {
      exchange.push({ method, params: JSON.parse(JSON.stringify(params)) });
      if (method === "wallet_prepareCalls") return PREPARED;
      if (method === "wallet_sendPreparedCalls") return { id: CALL_ID, preparedCallIds: [CALL_ID], details: { type: "user-operation", data: { hash: USER_OP_HASH, calls: [{ to: USDC, data: transferData, value: "0x0" }] } } };
      if (method === "wallet_getCallsStatus") {
        return { id: CALL_ID, chainId: `0x${CHAIN_ID.toString(16)}`, atomic: true, version: "2.0.0", status: 200, receipts: [{ transactionHash: `0x${"7a".repeat(32)}`, status: "0x1", logs: [], blockHash: `0x${"1".repeat(64)}`, blockNumber: "0x1", gasUsed: "0x1" }] };
      }
      throw new Error(`unexpected ${method}`);
    },
  });
  const client = createSmartWalletClient({
    signer: privateKeyToAccount(`0x${"11".repeat(32)}`),
    transport,
    chain: baseSepolia,
    account: SENDER,
  });
  return { client, exchange };
};

const storageDouble = () => {
  const map = new Map();
  return {
    map,
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
    getAllKeys: async () => [...map.keys()],
  };
};

// The user pays the network fee in USDC (post-operation mode, exact approval).
const FEE_CAPABILITIES = {
  paymaster: {
    policyId: "11111111-2222-4333-8444-555555555555",
    erc20: { tokenAddress: USDC, postOpSettings: { autoApprove: true } },
  },
};

const request = () => ({
  account: SENDER,
  calls: [{ to: USDC, value: 0n, data: transferData }],
  capabilities: FEE_CAPABILITIES,
});

test("the split submission sends the same requests as the SDK's own sendCalls", async () => {
  const reference = await build();
  const referenceResult = await reference.client.sendCalls(request());

  const split = await build();
  const storage = storageDouble();
  const ops = createPaymentOperations({
    storage,
    chainId: CHAIN_ID,
    provider: { getCallsStatus: (input) => split.client.getCallsStatus(input) },
    lock: runExclusiveOperation,
  });
  const result = await submitAndConfirm({
    client: split.client,
    ops,
    account: SENDER,
    calls: [{ target: USDC, value: 0n, data: transferData }],
    overrides: FEE_CAPABILITIES,
    sleep: async () => undefined,
  });

  const sent = (exchange) => exchange.filter((entry) => entry.method !== "wallet_getCallsStatus");
  assert.deepEqual(sent(split.exchange), sent(reference.exchange));
  const prepare = split.exchange.find((entry) => entry.method === "wallet_prepareCalls");
  assert.deepEqual(prepare.params[0].capabilities.paymasterService.erc20.tokenAddress.toLowerCase(), USDC.toLowerCase(), "the fee is asked for in USDC");
  assert.equal(prepare.params[0].capabilities.paymasterService.erc20.postOpSettings.autoApprove, true);
  assert.equal(referenceResult.id, CALL_ID);
  assert.equal(result.hash, `0x${"7a".repeat(32)}`);
  assert.equal(result.userOpHash, USER_OP_HASH, "the hash read before sending is the one in the call id");
  assert.deepEqual(parseCallId(CALL_ID), { chainId: CHAIN_ID, userOpHash: USER_OP_HASH });
});

test("the provider's own status action reads a call id the way the verifier expects", async () => {
  const { client } = await build();
  const status = await client.getCallsStatus({ id: CALL_ID });
  assert.equal(status.status, "success");
  assert.equal(status.statusCode, 200);
  assert.match(status.receipts[0].transactionHash, /^0x[0-9a-f]{64}$/);
});

test("the read-only status source the app uses answers over the real wallet transport, with no signer", async () => {
  const load2 = createLoader({ mocks: {} });
  const { createProviderStatusSource } = load2("services/providerStatus.ts");
  const { interpretCallsStatus, classifyProviderError } = load2("utils/operationStatus.ts");
  const { alchemyWalletTransport } = await import("@alchemy/wallet-apis");
  const { createClient } = await import("viem");
  const { getCallsStatus } = await import("viem/actions");
  const { baseSepolia } = await import("viem/chains");

  const seen = [];
  let answer;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push({ method: body.method, params: body.params });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, ...answer }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const source = createProviderStatusSource({ chain: baseSepolia, transport: alchemyWalletTransport({ apiKey: "test-key" }), createClient, getCallsStatus });
    const receipt = { transactionHash: `0x${"7a".repeat(32)}`, status: "0x1", logs: [], blockHash: `0x${"1".repeat(64)}`, blockNumber: "0x1", gasUsed: "0x1" };

    answer = { result: { id: CALL_ID, chainId: "0x14a34", atomic: true, version: "2.0.0", status: 200, receipts: [receipt] } };
    const confirmed = interpretCallsStatus(await source.getCallsStatus({ id: CALL_ID }));
    assert.equal(confirmed.kind, "confirmed");
    assert.equal(confirmed.transactionHash, `0x${"7a".repeat(32)}`);
    assert.deepEqual(seen.at(-1), { method: "wallet_getCallsStatus", params: [CALL_ID] });

    answer = { result: { id: CALL_ID, chainId: "0x14a34", atomic: true, version: "2.0.0", status: 100 } };
    assert.equal(interpretCallsStatus(await source.getCallsStatus({ id: CALL_ID })).kind, "pending");

    answer = { result: { id: CALL_ID, chainId: "0x14a34", atomic: true, version: "2.0.0", status: 500, receipts: [receipt] } };
    assert.equal(interpretCallsStatus(await source.getCallsStatus({ id: CALL_ID })).kind, "failed");

    // The provider not knowing the id is an error answer, which the verifier reads as "no trace", not "failed".
    answer = { error: { code: 5730, message: "Unknown bundle id" } };
    await assert.rejects(source.getCallsStatus({ id: CALL_ID }), (error) => classifyProviderError(error).kind === "unknown-call-id");
  } finally {
    globalThis.fetch = realFetch;
  }
});
