const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");
const {
  USER_SEARCH_SELECT,
  buildSearchFilter,
  normalizeSearchQuery,
} = require("../utils/userSearch.ts");

const fields = (filter) =>
  filter.OR.map((condition) => Object.keys(condition)[0]);

test("refuses a query shorter than a handle", () => {
  // Anything shorter turns the endpoint into a directory listing: "a" used to
  // return five accounts.
  assert.equal(buildSearchFilter("a"), null);
  assert.equal(buildSearchFilter("ab"), null);
  assert.equal(buildSearchFilter("@ab"), null);
  assert.equal(buildSearchFilter("   "), null);
});

test("searches handle and display name, not the address", () => {
  const filter = buildSearchFilter("@Alice");

  assert.deepEqual(fields(filter), ["handle", "displayName"]);
  assert.equal(filter.OR[0].handle.contains, "alice");
});

test("searches the address only when the query is one", () => {
  // A plain word matching an address fragment is how a handle got linked to a
  // wallet without anyone asking for it.
  assert.deepEqual(fields(buildSearchFilter("dead")), [
    "handle",
    "displayName",
  ]);

  const filter = buildSearchFilter("0xdEaD");
  assert.deepEqual(fields(filter), [
    "handle",
    "displayName",
    "smartAccountAddress",
  ]);
  assert.equal(filter.OR[2].smartAccountAddress.contains, "0xdead");
});

test("0x alone is not an address lookup", () => {
  assert.deepEqual(fields(buildSearchFilter("0x1")), ["handle", "displayName"]);
});

test("never returns publicAddress", () => {
  assert.equal("publicAddress" in USER_SEARCH_SELECT, false);
  assert.equal(USER_SEARCH_SELECT.smartAccountAddress, true);
});

test("normalizes the query the way the old service did", () => {
  assert.equal(normalizeSearchQuery("  @Alice "), "alice");
});
