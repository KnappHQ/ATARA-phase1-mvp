const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader({ allow: ["viem"] });
const { createChainReader, checkTransfer, ENTRY_POINTS, USER_OPERATION_EVENT, TRANSFER_EVENT } = load("services/userOperationChain.ts");
const { encodeEventTopics, encodeAbiParameters } = require("viem");

const ENTRY = ENTRY_POINTS[1];
const USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
const ACCOUNT = "0xaaaa00000000000000000000000000000000000a";
const OTHER_ACCOUNT = "0xbbbb00000000000000000000000000000000000b";
const RECIPIENT = "0x5999000000000000000000000000000000c0204c";
const HASH_A = `0x${"c6".repeat(32)}`;
const HASH_B = `0x${"d1".repeat(32)}`;
const TX = `0x${"7a".repeat(32)}`;
const PAYMENT = { recipient: RECIPIENT, amount: "10000000", token: USDC };
const pad = (address) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;

const userOpLog = ({ hash, sender = ACCOUNT, success = true, logIndex, block = 4990, tx = TX }) => ({
  address: ENTRY,
  topics: encodeEventTopics({ abi: [USER_OPERATION_EVENT], eventName: "UserOperationEvent", args: { userOpHash: hash, sender, paymaster: "0x0000000000000000000000000000000000000000" } }),
  data: encodeAbiParameters(
    [{ type: "uint256" }, { type: "bool" }, { type: "uint256" }, { type: "uint256" }],
    [0n, success, 1n, 1n],
  ),
  transactionHash: tx,
  blockNumber: BigInt(block),
  logIndex,
});
const transferLog = ({ from = ACCOUNT, to = RECIPIENT, value = 10_000_000n, logIndex, token = USDC, tx = TX }) => ({
  address: token,
  topics: encodeEventTopics({ abi: [TRANSFER_EVENT], eventName: "Transfer", args: { from, to } }),
  data: encodeAbiParameters([{ type: "uint256" }], [value]),
  transactionHash: tx,
  blockNumber: 4990n,
  logIndex,
});

const clientWith = ({ latest = 5000n, logs = [], receipt, getLogs, blockNumber } = {}) => {
  const calls = [];
  return {
    calls,
    getBlockNumber: blockNumber ?? (async () => latest),
    getLogs:
      getLogs ??
      (async (args) => {
        calls.push(args);
        return logs.filter((log) => log.blockNumber >= args.fromBlock && log.blockNumber <= args.toBlock && log.topics[1].toLowerCase() === args.args.userOpHash.toLowerCase());
      }),
    getTransactionReceipt: async () => receipt ?? { status: "success", logs },
  };
};
const search = (extra = {}) => ({ userOpHash: HASH_A, account: ACCOUNT, createdAt: 0, now: 60_000, payment: PAYMENT, ...extra });

test("finds an executed operation by its hash and matches the transfer inside it", async () => {
  const logs = [transferLog({ logIndex: 1 }), userOpLog({ hash: HASH_A, logIndex: 2 })];
  const client = clientWith({ logs });
  const answer = await createChainReader({ client }).findUserOperation(search());
  assert.equal(answer.status, "found");
  assert.equal(answer.success, true);
  assert.equal(answer.transactionHash, TX);
  assert.deepEqual(answer.transfer, { kind: "matched", token: USDC, recipient: RECIPIENT, amount: "10000000" });
  assert.deepEqual(client.calls[0].address, ENTRY_POINTS);
});

test("an operation that ran and reverted is reported as failed, and one that did not is only 'not found'", async () => {
  const reverted = await createChainReader({ client: clientWith({ logs: [userOpLog({ hash: HASH_A, logIndex: 2, success: false })] }) }).findUserOperation(search());
  assert.equal(reverted.status, "found");
  assert.equal(reverted.success, false);

  const missing = await createChainReader({ client: clientWith({ logs: [] }) }).findUserOperation(search());
  assert.equal(missing.status, "not-found");
  assert.equal(missing.complete, true);
});

test("a node that refuses wide log searches is asked in smaller windows until it answers", async () => {
  const seen = [];
  const logs = [userOpLog({ hash: HASH_A, logIndex: 2, block: 3000 }), transferLog({ logIndex: 1 })];
  const client = clientWith({
    latest: 20_000n,
    logs,
    getLogs: async (args) => {
      const width = args.toBlock - args.fromBlock + 1n;
      seen.push(width);
      if (width > 5_000n) throw Object.assign(new Error("query exceeds max block range 5000"), { name: "RpcRequestError" });
      return logs.filter((log) => log.blockNumber >= args.fromBlock && log.blockNumber <= args.toBlock && log.topics[1] === args.args.userOpHash);
    },
  });
  const answer = await createChainReader({ client }).findUserOperation(search({ createdAt: undefined, payment: null }));
  assert.equal(answer.status, "found");
  assert.ok(seen.some((width) => width > 5_000n), "started wide");
  assert.ok(seen.at(-1) <= 5_000n, "and narrowed");
});

test("an unreachable node is unreadable, and what is reported never contains the request URL", async () => {
  const secret = "https://base-sepolia.g.alchemy.com/v2/SECRETKEY";
  const down = await createChainReader({ client: clientWith({ blockNumber: async () => { throw Object.assign(new Error(`fetch failed ${secret}`), { name: "HttpRequestError" }); } }) }).findUserOperation(search());
  assert.equal(down.status, "unreadable");
  assert.equal(JSON.stringify(down).includes("SECRETKEY"), false);

  const midway = await createChainReader({ client: clientWith({ getLogs: async () => { throw new Error("Request timed out"); } }) }).findUserOperation(search());
  assert.equal(midway.status, "unreadable");
});

test("an event with the right hash but another sender is never read as our confirmation", async () => {
  const client = clientWith({ logs: [userOpLog({ hash: HASH_A, sender: OTHER_ACCOUNT, logIndex: 2 })] });
  const answer = await createChainReader({ client }).findUserOperation(search());
  assert.equal(answer.status, "unreadable");
});

test("two operations of one account in one bundle are told apart by position, not by amount and recipient", () => {
  // [transfer 1][userOp A][transfer 2][userOp B], identical amount and recipient.
  const logs = [
    transferLog({ logIndex: 0 }),
    userOpLog({ hash: HASH_A, logIndex: 1 }),
    transferLog({ logIndex: 2 }),
    userOpLog({ hash: HASH_B, logIndex: 3 }),
  ];
  const receipt = { logs };
  const first = checkTransfer(receipt, logs[1], ACCOUNT, PAYMENT);
  const second = checkTransfer(receipt, logs[3], ACCOUNT, PAYMENT);
  assert.equal(first.kind, "matched");
  assert.equal(second.kind, "matched");

  // An operation that paid nothing does not borrow its neighbour's transfer.
  const empty = [transferLog({ logIndex: 0 }), userOpLog({ hash: HASH_A, logIndex: 1 }), userOpLog({ hash: HASH_B, logIndex: 2 })];
  assert.equal(checkTransfer({ logs: empty }, empty[2], ACCOUNT, PAYMENT).kind, "missing");
});

test("a transfer that is not the payment that was meant is not a match", () => {
  const wrongAmount = [transferLog({ logIndex: 0, value: 9_999_999n }), userOpLog({ hash: HASH_A, logIndex: 1 })];
  assert.equal(checkTransfer({ logs: wrongAmount }, wrongAmount[1], ACCOUNT, PAYMENT).kind, "missing");
  const wrongRecipient = [transferLog({ logIndex: 0, to: OTHER_ACCOUNT }), userOpLog({ hash: HASH_A, logIndex: 1 })];
  assert.equal(checkTransfer({ logs: wrongRecipient }, wrongRecipient[1], ACCOUNT, PAYMENT).kind, "missing");
  const foreign = [transferLog({ logIndex: 0, from: OTHER_ACCOUNT }), userOpLog({ hash: HASH_A, logIndex: 1 })];
  assert.equal(checkTransfer({ logs: foreign }, foreign[1], ACCOUNT, PAYMENT).kind, "missing");
});

test("with nothing known about the payment, one clear transfer is read from the chain, several are not guessed", () => {
  const one = [transferLog({ logIndex: 0 }), userOpLog({ hash: HASH_A, logIndex: 1 })];
  assert.deepEqual(checkTransfer({ logs: one }, one[1], ACCOUNT, null), { kind: "matched", token: USDC, recipient: RECIPIENT, amount: "10000000" });
  const two = [transferLog({ logIndex: 0 }), transferLog({ logIndex: 1, value: 5n }), userOpLog({ hash: HASH_A, logIndex: 2 })];
  assert.equal(checkTransfer({ logs: two }, two[2], ACCOUNT, null).kind, "not-applicable");
});

test("a missing receipt does not hide that the operation ran", async () => {
  const client = clientWith({ logs: [userOpLog({ hash: HASH_A, logIndex: 2 })] });
  client.getTransactionReceipt = async () => { throw new Error("unavailable"); };
  const answer = await createChainReader({ client }).findUserOperation(search());
  assert.equal(answer.status, "found");
  assert.equal(answer.success, true);
  assert.equal(answer.transfer.kind, "not-applicable");
});

test("the search starts near the payment's own time instead of scanning weeks", async () => {
  const client = clientWith({ latest: 1_000_000n, logs: [] });
  await createChainReader({ client }).findUserOperation(search({ createdAt: 1_000_000, now: 1_000_000 + 10 * 60_000 }));
  const lowest = client.calls.reduce((low, call) => (call.fromBlock < low ? call.fromBlock : low), 10n ** 9n);
  assert.ok(1_000_000n - lowest < 5_000n, `searched back ${1_000_000n - lowest} blocks`);
});

test("against a real viem client the search sends the right eth_getLogs filter and reads the real log shape", async () => {
  const { createPublicClient, custom } = await import("viem");
  const { baseSepolia } = await import("viem/chains");
  const eventLog = userOpLog({ hash: HASH_A, logIndex: 2, block: 4990 });
  const transfer = transferLog({ logIndex: 1 });
  const wire = (log) => ({ ...log, blockNumber: `0x${log.blockNumber.toString(16)}`, logIndex: `0x${log.logIndex.toString(16)}`, blockHash: `0x${"1".repeat(64)}`, transactionIndex: "0x0", removed: false });
  const requests = [];
  const client = createPublicClient({
    chain: baseSepolia,
    transport: custom({
      request: async ({ method, params }) => {
        requests.push({ method, params });
        if (method === "eth_blockNumber") return "0x1388";
        if (method === "eth_getLogs") return [wire(eventLog)];
        if (method === "eth_getTransactionReceipt") {
          return { status: "0x1", transactionHash: TX, blockNumber: "0x136e", blockHash: `0x${"1".repeat(64)}`, transactionIndex: "0x0", from: ACCOUNT, to: ENTRY, cumulativeGasUsed: "0x1", gasUsed: "0x1", effectiveGasPrice: "0x1", contractAddress: null, logsBloom: `0x${"0".repeat(512)}`, type: "0x2", logs: [wire(transfer), wire(eventLog)] };
        }
        throw new Error(`unexpected ${method}`);
      },
    }),
  });
  const answer = await createChainReader({ client }).findUserOperation(search());
  assert.equal(answer.status, "found");
  assert.deepEqual(answer.transfer, { kind: "matched", token: USDC, recipient: RECIPIENT, amount: "10000000" });

  const getLogs = requests.find((request) => request.method === "eth_getLogs").params[0];
  assert.deepEqual(getLogs.address.map((a) => a.toLowerCase()), ENTRY_POINTS.map((a) => a.toLowerCase()));
  assert.equal(getLogs.topics[0], encodeEventTopics({ abi: [USER_OPERATION_EVENT], eventName: "UserOperationEvent" })[0]);
  assert.equal(getLogs.topics[1], HASH_A, "the operation hash is the indexed filter");
});
