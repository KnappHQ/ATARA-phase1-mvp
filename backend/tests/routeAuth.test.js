const assert = require("node:assert/strict");
const test = require("node:test");

// app.ts exits the process when JWT_SECRET is missing, and utils/constants
// reads the environment at import time - so both have to be set before the app
// is required.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.NODE_ENV = "test";

require("ts-node/register");
const request = require("supertest");
const app = require("../app.ts").default;

/**
 * Exercises the real app over HTTP, with every route and middleware wired as it
 * is in production.
 *
 * The rest of the suite tests pure functions, which means nothing catches a
 * route that loses its `authentication` middleware - the most damaging edit
 * anyone could make here, and an invisible one in a diff. These tests answer a
 * single question for every endpoint: does it let an anonymous caller in?
 *
 * None of them reach the database. An absent or malformed token is refused by
 * middleware/auth.middleware.ts before any query runs, which is what lets them
 * run in CI, where no Postgres is available.
 */

const PROTECTED = [
  ["get", "/api/v1/health/db"],

  ["get", "/api/v1/user/me"],
  ["patch", "/api/v1/user/me"],
  ["delete", "/api/v1/user/me"],
  ["get", "/api/v1/user/search?q=alice"],
  ["get", "/api/v1/user/quick-contacts"],
  ["get", "/api/v1/user/handle/alice"],

  ["get", "/api/v1/transaction/resolve/alice"],
  ["post", "/api/v1/transaction/sync"],
  ["get", "/api/v1/transaction/history"],
  ["get", "/api/v1/transaction/some-id"],
  ["patch", "/api/v1/transaction/some-id"],

  ["get", "/api/v1/wallet/portfolio"],
  ["post", "/api/v1/wallet/onramp-session"],

  ["get", "/api/v1/groups"],
  ["post", "/api/v1/groups"],
  ["get", "/api/v1/groups/some-id"],
  ["post", "/api/v1/groups/some-id/expenses"],
  ["patch", "/api/v1/groups/e/some-id/decision"],
  ["get", "/api/v1/groups/contacts/0xabc/balances"],

  ["post", "/api/v1/feedback"],

  ["get", "/api/v1/vaults"],
  ["get", "/api/v1/vaults/0xabc"],

  // Retired, but still behind authentication: it answers 410, never 200.
  ["get", "/api/v1/security/totp"],

  ["post", "/api/v1/requests"],
  ["delete", "/api/v1/requests/some-id"],
];

test("every protected route refuses an anonymous caller", async () => {
  for (const [method, path] of PROTECTED) {
    const response = await request(app)[method](path);

    assert.equal(
      response.status,
      401,
      `${method.toUpperCase()} ${path} answered ${response.status}, expected 401`,
    );
  }
});

test("a malformed bearer token is refused too", async () => {
  const response = await request(app)
    .get("/api/v1/user/me")
    .set("Authorization", "Bearer not-a-jwt");

  assert.equal(response.status, 401);
});

test("an Authorization header without the Bearer scheme is refused", async () => {
  const response = await request(app)
    .get("/api/v1/user/me")
    .set("Authorization", "Basic YWxpY2U6c2VjcmV0");

  assert.equal(response.status, 401);
});

test("the liveness probe stays public", async () => {
  // render.yaml points healthCheckPath here. Putting it behind authentication
  // would fail every deploy.
  const response = await request(app).get("/api/v1/health/backend");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");
});

test("the legal pages stay public", async () => {
  for (const path of ["/privacy", "/terms", "/account-deletion"]) {
    const response = await request(app).get(`/api/v1/legal${path}`);
    assert.equal(response.status, 200, `${path} answered ${response.status}`);
  }
});

test("a payment link with a malformed token is rejected before any lookup", async () => {
  // Public by design - the token is the credential - so the format check is
  // what stands between a stranger and a database query.
  const response = await request(app).get("/api/v1/requests/pay/not-a-token");

  assert.equal(response.status, 404);
});

test("an oversized JSON body is refused", async () => {
  const response = await request(app)
    .post("/api/v1/feedback")
    .set("Content-Type", "application/json")
    .send(JSON.stringify({ message: "a".repeat(200 * 1024) }));

  assert.equal(response.status, 413);
});

test("an unknown route does not leak a stack trace", async () => {
  const response = await request(app).get("/api/v1/does-not-exist");

  assert.equal(response.status, 404);
  assert.equal("stack" in response.body, false);
});
