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

test("never maps an address back to a handle", () => {
  // An address is public on the chain. Answering "whose is this?" to any
  // signed-in account would put a name on every transfer anyone can see.
  for (const query of ["dead", "0xdEaD", "0x1111111111111111111111111111111111111111", "0x1"]) {
    assert.deepEqual(fields(buildSearchFilter(query)), ["handle", "displayName"]);
  }
});

test("never returns publicAddress", () => {
  assert.equal("publicAddress" in USER_SEARCH_SELECT, false);
  assert.equal(USER_SEARCH_SELECT.smartAccountAddress, true);
});

test("normalizes the query the way the old service did", () => {
  assert.equal(normalizeSearchQuery("  @Alice "), "alice");
});
