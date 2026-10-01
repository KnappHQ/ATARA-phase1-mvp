const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

if (!process.env.TEST_DATABASE_URL) {
  test.skip("miles ledger and card webhook (requires TEST_DATABASE_URL)", () => {});
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  process.env.NODE_ENV = "test";
  process.env.CARD_PROVIDER = "sandbox";
  process.env.CARD_WEBHOOK_SECRET = "whsec_integration";

  require("ts-node/register");
  const jwt = require("jsonwebtoken");
  const request = require("supertest");
  const prisma = require("../config/prisma.ts").default;
  const app = require("../app.ts").default;
  const { rewardsService } = require("../services/rewards.service.ts");
  const { userService } = require("../services/user.service.ts");

  const suffix = Date.now().toString(36);
  const ids = [];
  const makeUser = async (name, data = {}) => {
    const id = `${name}-${suffix}`;
    ids.push(id);
    await prisma.user.create({ data: { id, handle: `${name}_${suffix}`, ...data } });
    return id;
  };
  const token = (id) => jwt.sign({ id, tv: 0 }, process.env.JWT_SECRET, { algorithm: "HS256" });
  const sign = (body) => crypto.createHmac("sha256", process.env.CARD_WEBHOOK_SECRET).update(body).digest("hex");
  const deliver = (event) => {
    const body = JSON.stringify(event);
    return request(app)
      .post("/api/v1/card/webhook/sandbox")
      .set("Content-Type", "application/json")
      .set("x-atara-signature", sign(body))
      .send(body);
  };
  const purchase = (userRef, purchaseId, amountUsdCents, eventId = `evt-${purchaseId}`) => ({ eventId, type: "purchase", userRef, purchaseId, amountUsdCents });

  test.after(async () => {
    await prisma.cardEvent.deleteMany({ where: { eventId: { contains: suffix } } });
    await prisma.milesEntry.deleteMany({ where: { sourceId: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test("a purchase credits miles by the buyer's plan, and the same event twice credits once", async () => {
    const free = await makeUser("free");
    const max = await makeUser("max", { subscriptionTier: "MAX", subscriptionStatus: "ACTIVE" });

    const first = await deliver(purchase(free, `p1-${suffix}`, 2599));
    assert.equal(first.status, 200);
    assert.equal(first.body.outcome, "credited");
    assert.equal(await rewardsService.balance(free), 25);

    const again = await deliver(purchase(free, `p1-${suffix}`, 2599));
    assert.equal(again.body.outcome, "duplicate");
    assert.equal(await rewardsService.balance(free), 25);

    await deliver(purchase(max, `p2-${suffix}`, 2599));
    assert.equal(await rewardsService.balance(max), 75);
  });

  test("many deliveries of one event at the same instant credit exactly once", async () => {
    const user = await makeUser("race");
    const results = await Promise.all(Array.from({ length: 8 }, () => deliver(purchase(user, `race-${suffix}`, 10_000, `evt-race-${suffix}`))));
    for (const response of results) assert.equal(response.status, 200);
    assert.equal(await rewardsService.balance(user), 100);
    assert.equal(await prisma.milesEntry.count({ where: { userId: user } }), 1);
    assert.equal(await prisma.cardEvent.count({ where: { eventId: `evt-race-${suffix}` } }), 1);
  });

  test("a second purchase with a new event id but the same purchase id still credits once", async () => {
    const user = await makeUser("replay");
    await deliver(purchase(user, `same-${suffix}`, 5000, `evt-a-${suffix}`));
    await deliver(purchase(user, `same-${suffix}`, 5000, `evt-b-${suffix}`));
    assert.equal(await rewardsService.balance(user), 50);
  });

  test("a refund takes back what the purchase earned, once, and the balance never goes negative", async () => {
    const user = await makeUser("refund");
    await deliver(purchase(user, `r1-${suffix}`, 4000));
    await deliver(purchase(user, `r2-${suffix}`, 1000));
    assert.equal(await rewardsService.balance(user), 50);
    // 30 of the 50 miles are spent before the refund of the 40-mile purchase arrives.
    await rewardsService.redeem({ userId: user, sourceId: `send-${suffix}-1`, miles: 30 });
    const refund = { eventId: `evt-ref-${suffix}`, type: "refund", userRef: user, purchaseId: `r1-${suffix}` };
    assert.equal((await deliver(refund)).body.outcome, "reversed");
    // Only the 20 miles still there are taken back: no debt.
    assert.equal(await rewardsService.balance(user), 0);
    assert.equal((await deliver({ ...refund, eventId: `evt-ref2-${suffix}` })).status, 200);
    assert.equal(await rewardsService.balance(user), 0);
    assert.equal(await prisma.milesEntry.count({ where: { userId: user, kind: "REVERSAL" } }), 1);
    // Spend is net of the refund.
    assert.equal(await rewardsService.monthlySpendUsdCents(user), 1000);
  });

  test("miles are spent only when the balance covers them, and two requests cannot spend the same miles", async () => {
    const user = await makeUser("redeem");
    await deliver(purchase(user, `d1-${suffix}`, 3000)); // 30 miles
    await assert.rejects(rewardsService.redeem({ userId: user, sourceId: `big-${suffix}`, miles: 31 }), /Not enough miles/);
    assert.equal(await rewardsService.balance(user), 30);

    const outcomes = await Promise.allSettled(
      [1, 2, 3, 4].map((n) => rewardsService.redeem({ userId: user, sourceId: `race-send-${suffix}-${n}`, miles: 20 })),
    );
    assert.equal(outcomes.filter((o) => o.status === "fulfilled" && o.value.redeemed).length, 1);
    assert.equal(outcomes.filter((o) => o.status === "rejected").length, 3);
    assert.equal(await rewardsService.balance(user), 10);

    // The same thing paid for twice is spent once.
    const user2 = await makeUser("redeem2");
    await deliver(purchase(user2, `d2-${suffix}`, 10_000));
    assert.equal((await rewardsService.redeem({ userId: user2, sourceId: `once-${suffix}`, miles: 20 })).redeemed, true);
    assert.equal((await rewardsService.redeem({ userId: user2, sourceId: `once-${suffix}`, miles: 20 })).redeemed, false);
    assert.equal(await rewardsService.balance(user2), 80);
    for (const bad of [0, -5, 1.5]) await assert.rejects(rewardsService.redeem({ userId: user2, sourceId: `x-${suffix}`, miles: bad }));
  });

  test("an event for an account that does not exist is acknowledged and credits nothing", async () => {
    const response = await deliver(purchase(`nobody-${suffix}`, `ghost-${suffix}`, 5000));
    assert.equal(response.status, 200);
    assert.equal(response.body.outcome, "unknown-user");
    assert.equal(await prisma.milesEntry.count({ where: { sourceId: `ghost-${suffix}` } }), 0);
  });

  test("what the app is told: offer, miles, allowance and card status, from the server's own records", async () => {
    const user = await makeUser("me");
    await deliver(purchase(user, `m1-${suffix}`, 10_000)); // $100 this month, FREE: 100 miles, +2 sends
    let response = await request(app).get("/api/v1/subscription/me").set("Authorization", `Bearer ${token(user)}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.plan, "FREE");
    assert.equal(response.body.miles.balance, 100);
    assert.equal(response.body.miles.monthlyCardSpendUsdCents, 10_000);
    assert.equal(response.body.miles.sponsoredAllowance, 12);

    response = await request(app).get("/api/v1/card/status").set("Authorization", `Bearer ${token(user)}`);
    assert.equal(response.body.state, "not_applied");
    assert.equal(response.body.waitlisted, false);
    response = await request(app).post("/api/v1/card/waitlist").set("Authorization", `Bearer ${token(user)}`).send({ country: "fr; DROP TABLE" });
    assert.equal(response.status, 200);
    assert.equal((await prisma.cardWaitlist.findUnique({ where: { userId: user } })).country, null, "free text is never stored");
    await request(app).post("/api/v1/card/waitlist").set("Authorization", `Bearer ${token(user)}`).send({ country: "fr" });
    assert.equal((await prisma.cardWaitlist.findUnique({ where: { userId: user } })).country, "FR");

    response = await request(app).get("/api/v1/plans").set("Authorization", `Bearer ${token(user)}`);
    assert.deepEqual(response.body.plans.map((p) => p.id), ["FREE", "PLUS", "MAX"]);
  });

  test("an offer comes only from the stored subscription, and an expired or inactive one is Free", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const active = await makeUser("plus", { subscriptionTier: "PLUS", subscriptionStatus: "ACTIVE", subscriptionExpiresAt: future });
    const expired = await makeUser("expired", { subscriptionTier: "MAX", subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date(Date.now() - 1000) });
    const canceled = await makeUser("canceled", { subscriptionTier: "MAX", subscriptionStatus: "CANCELED" });
    const plan = async (id) => (await request(app).get("/api/v1/subscription/me").set("Authorization", `Bearer ${token(id)}`)).body.plan;
    assert.equal(await plan(active), "PLUS");
    assert.equal(await plan(expired), "FREE");
    assert.equal(await plan(canceled), "FREE");
  });

  test("no client request can promote an account", async () => {
    const user = await makeUser("promote");
    const attempts = [
      request(app).patch("/api/v1/user/me").send({ subscriptionTier: "MAX", subscriptionStatus: "ACTIVE", plan: "MAX" }),
      request(app).post("/api/v1/subscription/me").send({ plan: "MAX" }),
      request(app).put("/api/v1/subscription/me").send({ plan: "MAX" }),
      request(app).post("/api/v1/plans").send({ plan: "MAX" }),
    ];
    for (const attempt of attempts) await attempt.set("Authorization", `Bearer ${token(user)}`);
    const stored = await prisma.user.findUnique({ where: { id: user }, select: { subscriptionTier: true, subscriptionStatus: true } });
    assert.deepEqual(stored, { subscriptionTier: "FREE", subscriptionStatus: "INACTIVE" });
    const response = await request(app).get("/api/v1/subscription/me").set("Authorization", `Bearer ${token(user)}`);
    assert.equal(response.body.plan, "FREE");
  });

  test("deleting the account removes its miles and waiting-list entry, and keeps only the fact an event happened", async () => {
    const user = await makeUser("gone");
    await deliver(purchase(user, `g1-${suffix}`, 5000, `evt-g1-${suffix}`));
    await prisma.cardWaitlist.create({ data: { userId: user, country: "FR" } });
    await userService.deleteAccount(user);
    assert.equal(await prisma.milesEntry.count({ where: { userId: user } }), 0);
    assert.equal(await prisma.cardWaitlist.count({ where: { userId: user } }), 0);
    const event = await prisma.cardEvent.findUnique({ where: { provider_eventId: { provider: "sandbox", eventId: `evt-g1-${suffix}` } } });
    assert.equal(event.userId, null);
  });
}
