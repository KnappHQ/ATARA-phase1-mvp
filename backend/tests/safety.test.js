const assert = require("node:assert/strict");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.NODE_ENV = "test";
require("ts-node/register");

const request = require("supertest");
const prisma = require("../config/prisma.ts").default;
const app = require("../app.ts").default;
const { safetyService } = require("../services/safety.service.ts");
const safety = require("../utils/safety.ts");

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
const rejects = (promise, status) =>
  assert.rejects(promise, (error) => (status === undefined ? true : error.statusCode === status));

// -------------------------------------------------------------- the input rules

test("a report needs a person and a reason from the list", () => {
  assert.throws(() => safety.parseReport({}), /who you are reporting/);
  assert.throws(() => safety.parseReport({ handle: "bad handle!", reason: "SPAM" }), /who you are reporting/);
  assert.throws(() => safety.parseReport({ handle: "bob", reason: "RUDE" }), /reason/);
  assert.throws(() => safety.parseReport({ handle: "bob" }), /reason/);
  const ok = safety.parseReport({ handle: "@Bob", reason: "spam", details: "  hello  ", alsoBlock: true });
  assert.deepEqual(ok, { handle: "bob", reason: "SPAM", details: "hello", context: null, contextId: null, alsoBlock: true });
});

test("details are text, at most 500 characters, and an item to report must say where it is", () => {
  assert.throws(() => safety.parseReport({ handle: "bob", reason: "SCAM", details: 5 }), /text/);
  assert.throws(() => safety.parseReport({ handle: "bob", reason: "SCAM", details: "x".repeat(501) }), /500/);
  assert.equal(safety.parseReport({ handle: "bob", reason: "SCAM", details: "x".repeat(500) }).details.length, 500);
  assert.throws(() => safety.parseReport({ handle: "bob", reason: "SCAM", context: "nonsense" }), /cannot be reported/);
  assert.throws(() => safety.parseReport({ handle: "bob", reason: "SCAM", context: "group" }), /cannot be reported/);
  assert.throws(() => safety.parseReport({ handle: "bob", reason: "SCAM", context: "group", contextId: "../etc" }), /cannot be reported/);
  const note = safety.parseReport({ handle: "bob", reason: "HARASSMENT", context: "payment_note", contextId: "abc-123" });
  assert.deepEqual([note.context, note.contextId], ["payment_note", "abc-123"]);
  assert.deepEqual(
    (({ context, contextId }) => ({ context, contextId }))(safety.parseReport({ handle: "bob", reason: "OTHER", context: "contact", contextId: "ignored" })),
    { context: "contact", contextId: null },
  );
});

test("a hostile report cannot inject markup into the email the team reads", () => {
  const html = safety.reportEmailHtml({
    id: "r1",
    reason: "SPAM",
    reporterHandle: "<img src=x onerror=alert(1)>",
    reportedHandle: "bob",
    details: "<script>alert(1)</script>",
    context: "contact",
    contextId: null,
    createdAt: new Date(0),
  });
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(safety.SUPPORT_EMAIL, "support@atara.finance");
});

// ----------------------------------------------------------------- the service

test("a report is stored first, and a failing mailer loses nothing", async () => {
  const created = [];
  const result = await withStubs(
    [
      [prisma.user, "findUnique", async () => ({ id: "u2", handle: "bob", displayName: null, deletedAt: null })],
      [prisma.userReport, "create", async ({ data }) => (created.push(data), { id: "r1", createdAt: new Date(), ...data })],
    ],
    () => safetyService.report({ id: "u1", handle: "alice" }, { handle: "bob", reason: "SCAM", details: "asked me for my key" }),
  );
  assert.equal(result.id, "r1");
  assert.equal(created.length, 1);
  assert.deepEqual([created[0].reporterId, created[0].reportedId, created[0].reportedHandle, created[0].reason], ["u1", "u2", "bob", "SCAM"]);
});

test("reporting yourself, or someone who does not exist, is refused", async () => {
  await withStubs([[prisma.user, "findUnique", async () => ({ id: "u1", handle: "alice", deletedAt: null })]], async () => {
    await rejects(safetyService.report({ id: "u1" }, { handle: "alice", reason: "SPAM" }), 400);
  });
  await withStubs([[prisma.user, "findUnique", async () => null]], async () => {
    await rejects(safetyService.report({ id: "u1" }, { handle: "ghost", reason: "SPAM" }), 404);
    await rejects(safetyService.block("u1", "ghost"), 404);
  });
  await withStubs([[prisma.user, "findUnique", async () => ({ id: "u3", handle: "gone", deletedAt: new Date() })]], async () => {
    await rejects(safetyService.report({ id: "u1" }, { handle: "gone", reason: "SPAM" }), 404);
  });
});

test("a report about an item both people cannot see is refused", async () => {
  await withStubs(
    [
      [prisma.user, "findUnique", async () => ({ id: "u2", handle: "bob", deletedAt: null })],
      [prisma.transaction, "findUnique", async () => ({ senderId: "u2", receiverId: "u9" })],
      [prisma.groupMember, "count", async () => 1],
      [prisma.userReport, "create", async () => assert.fail("must not be stored")],
    ],
    async () => {
      await rejects(safetyService.report({ id: "u1" }, { handle: "bob", reason: "SPAM", context: "payment_note", contextId: "t1" }), 400);
      await rejects(safetyService.report({ id: "u1" }, { handle: "bob", reason: "SPAM", context: "group", contextId: "g1" }), 400);
    },
  );
});

test("blocking works both ways and ends invitations between the two", async () => {
  const calls = [];
  await withStubs(
    [
      [prisma.user, "findUnique", async () => ({ id: "u2", handle: "bob", deletedAt: null })],
      [prisma.userBlock, "upsert", async (args) => calls.push(["upsert", args.create])],
      [prisma.groupMember, "deleteMany", async (args) => calls.push(["deleteMany", args.where])],
    ],
    async () => {
      await safetyService.block("u1", "@Bob");
    },
  );
  assert.deepEqual(calls[0], ["upsert", { blockerId: "u1", blockedId: "u2" }]);
  assert.equal(calls[1][1].status, "INVITED");
  assert.deepEqual(calls[1][1].OR, [
    { userId: "u1", invitedById: "u2" },
    { userId: "u2", invitedById: "u1" },
  ]);

  const blocked = await withStubs(
    [[prisma.userBlock, "findMany", async () => [{ blockerId: "u1", blockedId: "u2" }, { blockerId: "u3", blockedId: "u1" }]]],
    () => safetyService.blockedBothWays("u1"),
  );
  assert.deepEqual([...blocked].sort(), ["u2", "u3"], "the ones you blocked and the ones who blocked you");
});

// ------------------------------------------------------------ the admin review

test("the admin view exists only with a long token, and looks like a missing route otherwise", async () => {
  const restore = stub(process.env, "SAFETY_ADMIN_TOKEN", undefined);
  try {
    assert.equal(safetyService.isAdminToken("anything"), false);
    assert.equal((await request(app).get("/api/v1/safety/admin/reports")).status, 404);
  } finally {
    restore();
  }
  process.env.SAFETY_ADMIN_TOKEN = "x".repeat(32);
  try {
    assert.equal(safetyService.isAdminToken("x".repeat(32)), true);
    assert.equal(safetyService.isAdminToken("x".repeat(31)), false);
    assert.equal(safetyService.isAdminToken("y".repeat(32)), false);
    assert.equal(safetyService.isAdminToken(undefined), false);
    assert.equal((await request(app).get("/api/v1/safety/admin/reports").set("x-admin-token", "wrong")).status, 404);
    const listed = await withStubs([[prisma.userReport, "findMany", async () => [{ id: "r1", reason: "SPAM" }]]], () =>
      request(app).get("/api/v1/safety/admin/reports?status=OPEN").set("x-admin-token", "x".repeat(32)),
    );
    assert.equal(listed.status, 200);
    assert.equal(listed.body.reports[0].id, "r1");
  } finally {
    delete process.env.SAFETY_ADMIN_TOKEN;
  }
  process.env.SAFETY_ADMIN_TOKEN = "short";
  try {
    assert.equal(safetyService.isAdminToken("short"), false, "a short token is never accepted");
  } finally {
    delete process.env.SAFETY_ADMIN_TOKEN;
  }
});

// -------------------------------------------------------------------- the wiring

test("every report, block and invitation route needs a signed-in user", async () => {
  for (const [method, url] of [
    ["get", "/api/v1/safety/blocks"],
    ["post", "/api/v1/safety/blocks"],
    ["delete", "/api/v1/safety/blocks/bob"],
    ["post", "/api/v1/safety/reports"],
    ["get", "/api/v1/groups/invitations"],
    ["post", "/api/v1/groups/g1/invitation/accept"],
    ["delete", "/api/v1/groups/g1/invitation"],
  ]) {
    const response = await request(app)[method](url);
    assert.equal(response.status, 401, `${method} ${url}`);
  }
});
