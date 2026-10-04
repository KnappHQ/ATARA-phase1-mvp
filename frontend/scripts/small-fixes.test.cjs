const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const site = createLoader()("utils/site.ts");

// ------------------------------------------------------------ the invite link

test("the invite points to the real website, from one place", () => {
  assert.equal(site.DEFAULT_SITE_URL, "https://atara.finance");
  assert.equal(site.inviteMessage(), "Join me on ATARA to send and receive money instantly: https://atara.finance");
  assert.match(read("components/send/ContactsList.tsx"), /message: inviteMessage\(\)/);
});

test("the website setting is cleaned up and never lets a broken value reach the invite", () => {
  assert.equal(site.siteUrl("https://atara.finance/"), "https://atara.finance");
  assert.equal(site.siteUrl("  https://example.org///"), "https://example.org");
  for (const bad of [undefined, "", "   ", "atara.finance", "http://atara.finance", "javascript:alert(1)"]) {
    assert.equal(site.siteUrl(bad), "https://atara.finance", String(bad));
  }
});

test("the dead domain appears nowhere in the app", () => {
  const skip = new Set(["node_modules", "dist", ".expo", "package-lock.json"]);
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|cjs|json)$/.test(entry.name) && /atara\.money/.test(fs.readFileSync(full, "utf8"))) hits.push(path.relative(root, full));
    }
  };
  walk(root);
  assert.deepEqual(hits.filter((file) => !file.endsWith("small-fixes.test.cjs")), []);
});

// ------------------------------------------------------- the English-only UI

test("no French text is left in the screens", () => {
  assert.doesNotMatch(read("components/groupDetails/AddExpenseModal.tsx"), /Part de/);
  assert.match(read("components/groupDetails/AddExpenseModal.tsx"), /accessibilityLabel=\{`Share for @\$\{member\.handle\}`\}/);
  assert.doesNotMatch(read("components/groupDetails/GroupExpenseItem.tsx"), /Contester/);
  assert.match(read("components/groupDetails/GroupExpenseItem.tsx"), />Dispute</);
});

test("the receipt says Network fee, not Gas Paid", () => {
  const receipt = read("components/transaction/TransactionReceipt.tsx");
  assert.doesNotMatch(receipt, /Gas Paid/);
  assert.match(receipt, />Network fee</);
});
