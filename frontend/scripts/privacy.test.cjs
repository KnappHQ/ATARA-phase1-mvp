const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const load = (relativePath) => {
  const file = path.join(__dirname, "..", relativePath);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function("exports", "require", code)(exports, (specifier) => {
    throw new Error(`Unexpected import ${specifier}`);
  });
  return exports;
};

const { scrubText, scrubBreadcrumb, scrubEvent } = load("utils/privacyScrub.ts");
const { toUserProfile } = load("utils/userProfile.ts");

const ADDRESS = "0x1111111111111111111111111111111111111111";
const TOKEN = "a".repeat(64);

test("crash reports lose addresses, tokens, emails, handles and queries", () => {
  const text = [
    `GET https://api.atara.finance/api/v1/requests/pay/${TOKEN}`,
    "GET https://api.atara.finance/api/v1/user/search?q=alice",
    "GET https://api.atara.finance/api/v1/transaction/resolve/alice",
    `balance of ${ADDRESS} for bob@example.com`,
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
  ].join("\n");
  const scrubbed = scrubText(text);

  for (const secret of [TOKEN, ADDRESS, "q=alice", "resolve/alice", "bob@example.com", "eyJhbGci"]) {
    assert.ok(!scrubbed.includes(secret), `${secret} leaked`);
  }
  // Still enough to tell which endpoint failed.
  assert.match(scrubbed, /\/api\/v1\/user\/search/);
  assert.match(scrubbed, /\/transaction\/resolve\/\[handle\]/);
});

test("breadcrumbs are scrubbed in their message and data", () => {
  const breadcrumb = scrubBreadcrumb({
    category: "xhr",
    message: `sent to ${ADDRESS}`,
    data: { url: `https://api.atara.finance/api/v1/requests/${TOKEN}`, method: "GET", status_code: 500 },
  });
  assert.equal(breadcrumb.category, "xhr");
  assert.ok(!breadcrumb.message.includes(ADDRESS));
  assert.ok(!breadcrumb.data.url.includes(TOKEN));
  assert.equal(breadcrumb.data.status_code, 500);
});

test("a report keeps its own ids but only the opaque user id", () => {
  const eventId = "b".repeat(32);
  const event = scrubEvent({
    event_id: eventId,
    contexts: { trace: { trace_id: "c".repeat(32) } },
    exception: { values: [{ type: "Error", value: `Unknown account ${ADDRESS}` }] },
    request: { url: "https://x.test/pay?to=alice", query_string: "to=alice", headers: { Authorization: "Bearer x" } },
    user: { id: "user-1", email: "bob@example.com", username: "bob", ip_address: "1.2.3.4" },
  });
  assert.equal(event.event_id, eventId);
  assert.equal(event.contexts.trace.trace_id, "c".repeat(32));
  assert.ok(!event.exception.values[0].value.includes(ADDRESS));
  assert.equal(event.request.url, "https://x.test/pay");
  assert.equal(event.request.query_string, undefined);
  assert.equal(event.request.headers, undefined);
  assert.deepEqual(event.user, { id: "user-1" });
});

test("only the account profile is kept on the phone", () => {
  const profile = toUserProfile({
    id: "user-1",
    handle: "alice",
    smartAccountAddress: ADDRESS,
    displayName: "Alice",
    email: null,
    publicAddress: "0x2222222222222222222222222222222222222222",
    totpSecretEncrypted: "secret",
    recoveryPhone: "+33600000000",
    tokenVersion: 3,
  });
  assert.deepEqual(profile, {
    id: "user-1",
    handle: "alice",
    smartAccountAddress: ADDRESS,
    displayName: "Alice",
  });
});

const { openBook, forgetBook, migrateAddressBooks } = load("utils/addressBookScope.ts");

test("one account's nicknames are not shown to the next account on the phone", () => {
  let state = { books: {}, legacy: null };
  state = openBook(state, "alice");
  state = { books: { ...state.books, alice: { [ADDRESS]: "Landlord" } }, legacy: null };

  assert.deepEqual(openBook(state, "bob").contacts, {});
  assert.deepEqual(openBook(state, "alice").contacts, { [ADDRESS]: "Landlord" });
});

test("nicknames saved before the update stay with the phone's account", () => {
  const migrated = migrateAddressBooks({ contacts: { [ADDRESS]: "Mum" } }, 0);
  const opened = openBook(migrated, "alice");
  assert.deepEqual(opened.contacts, { [ADDRESS]: "Mum" });
  assert.equal(opened.legacy, null);
  // Claimed once: another account signing in later does not get them.
  assert.deepEqual(openBook(opened, "bob").contacts, {});
});

test("deleting an account deletes its nicknames", () => {
  const state = { books: { alice: { [ADDRESS]: "Mum" }, bob: {} }, legacy: null };
  assert.deepEqual(Object.keys(forgetBook(state, "alice").books), ["bob"]);
});
