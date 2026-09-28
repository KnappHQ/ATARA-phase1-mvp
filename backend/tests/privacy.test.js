const assert = require("node:assert/strict");
const test = require("node:test");

// Signing a session token needs a secret; the constants module reads it once.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
require("ts-node/register");

const prisma = require("../config/prisma.ts").default;
const { transactionService } = require("../services/transaction.service.ts");
const { userService } = require("../services/user.service.ts");
const {
  paymentRequestService,
  CONFIRMATION_GRACE_MS,
} = require("../services/paymentRequest.service.ts");

const stub = (object, key, value) => {
  const original = object[key];
  object[key] = value;
  return () => {
    object[key] = original;
  };
};

const withStubs = async (stubs, run) => {
  const restores = stubs.map(([object, key, value]) => stub(object, key, value));
  try {
    return await run();
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
};

// Records every select a service asks Prisma for, and answers with a row.
const recordingSelect = (row) => {
  const selects = [];
  const find = async (args) => {
    selects.push(args.select);
    return row;
  };
  return { selects, find };
};

test("looking someone up never returns the key that controls their account", async () => {
  const { selects, find } = recordingSelect({ id: "u1", handle: "alice" });
  await withStubs(
    [
      [prisma.user, "findUnique", find],
    ],
    async () => {
      await transactionService.resolveHandle("alice");
      await userService.getUserByHandle("alice");
    },
  );
  for (const select of selects) {
    assert.equal("publicAddress" in select, false);
    assert.equal(select.smartAccountAddress, true);
  }
});

test("recent contacts never carry the owner address", async () => {
  let args;
  await withStubs(
    [[prisma.transaction, "findMany", async (received) => { args = received; return []; }]],
    () => userService.getRecentContacts("u1"),
  );
  assert.equal("publicAddress" in args.select.sender.select, false);
  assert.equal("publicAddress" in args.select.receiver.select, false);
});

test("the receiver cannot rewrite the sender's note or category", async () => {
  let updated = false;
  await withStubs(
    [
      [prisma.transaction, "findUnique", async () => ({ id: "t1", senderId: "sender", receiverId: "receiver" })],
      [prisma.transaction, "update", async () => { updated = true; return {}; }],
    ],
    async () => {
      await assert.rejects(
        transactionService.updateTransaction("receiver", "t1", "food", "rewritten"),
        (error) => error.statusCode === 403,
      );
      assert.equal(updated, false);

      await transactionService.updateTransaction("sender", "t1", "food", "dinner");
      assert.equal(updated, true);
    },
  );
});

const token = "a".repeat(64);
const created = new Date("2026-01-01T00:00:00Z");
const expires = new Date("2026-01-02T00:00:00Z");
const request = (fields = {}) => ({
  id: "r1",
  tokenHash: "h",
  creatorId: "u1",
  recipientAddress: "0x1111111111111111111111111111111111111111",
  amount: { toString: () => "12.50" },
  note: "Rent, flat 3B",
  chainId: 84532,
  tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  createdAt: created,
  expiresAt: expires,
  paidAt: null,
  cancelledAt: null,
  txHash: null,
  ...fields,
});

const detailsFor = (row, now) =>
  withStubs(
    [[prisma.paymentRequest, "findUnique", async () => row]],
    () => paymentRequestService.publicDetails(token, now),
  );

test("an open payment link shows what the payer needs", async () => {
  const details = await detailsFor(request(), new Date("2026-01-01T12:00:00Z"));
  assert.equal(details.status, "OPEN");
  assert.equal(details.amount, "12.50");
  assert.equal(details.recipientAddress, request().recipientAddress);
  assert.match(details.confirmationMessage, /Request: r1/);
});

test("a paid or canceled link shows its status and nothing else", async () => {
  const later = new Date("2026-01-01T12:00:00Z");
  for (const row of [
    request({ paidAt: later, txHash: `0x${"b".repeat(64)}` }),
    request({ cancelledAt: later }),
  ]) {
    const details = await detailsFor(row, later);
    assert.deepEqual(Object.keys(details), ["status"]);
  }
});

test("an expired link stays readable only long enough to confirm a payment sent in time", async () => {
  const withinGrace = new Date(expires.getTime() + CONFIRMATION_GRACE_MS - 1);
  const graceDetails = await detailsFor(request(), withinGrace);
  assert.equal(graceDetails.status, "EXPIRED");
  assert.ok(graceDetails.confirmationMessage);

  const afterGrace = new Date(expires.getTime() + CONFIRMATION_GRACE_MS);
  assert.deepEqual(await detailsFor(request(), afterGrace), { status: "EXPIRED" });
});

test("signing in returns the profile, not the account row", async () => {
  const { authService } = require("../services/auth.service.ts");
  const row = {
    id: "u1",
    handle: "alice",
    publicAddress: "0x2222222222222222222222222222222222222222",
    smartAccountAddress: "0x1111111111111111111111111111111111111111",
    displayName: "Alice",
    email: "alice@example.com",
    profilePicUrl: null,
    authProvider: "passkey",
    totpSecretEncrypted: "secret",
    recoveryPhone: "+33600000000",
    tokenVersion: 0,
    deletedAt: null,
  };
  const { user } = await withStubs(
    [[prisma.user, "findUnique", async () => row]],
    () => authService.login(row.publicAddress),
  );
  assert.deepEqual(Object.keys(user).sort(), [
    "authProvider",
    "displayName",
    "email",
    "handle",
    "id",
    "profilePicUrl",
    "smartAccountAddress",
  ]);
});
