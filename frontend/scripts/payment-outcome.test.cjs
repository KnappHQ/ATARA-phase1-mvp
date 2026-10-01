const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const { describeOutcome } = createLoader()("utils/paymentOutcome.ts");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("the receipt says Sending while it waits, says nothing once confirmed, and never says failed for 'maybe'", () => {
  assert.equal(describeOutcome("pending").title, "Sending…");
  assert.equal(describeOutcome("confirmed"), null);
  const unsure = describeOutcome("pending", "Awaiting chain verification. Check Activity before sending again.");
  assert.equal(unsure.title, "Still being verified");
  assert.doesNotMatch(unsure.title + unsure.body, /did not go through|failed|no money/i);
  const failed = describeOutcome("failed", "The network never included this payment.");
  assert.equal(failed.tone, "bad");
  assert.match(failed.body, /No money was sent/);
});

test("the swipe goes straight home as soon as the payment is accepted, and does not navigate twice", () => {
  const step = read("components/send/AmountStep.tsx");
  assert.match(step, /onAccepted: \(\) => leaveSendFlow\(\)/);
  assert.match(step, /if \(movedOn\) return;\s*movedOn = true;/);
  assert.match(step, /useAlertStore\.getState\(\)\.success\("Payment sent"/);
  assert.match(step, /router\.replace\("\/\(tabs\)"\)/);
  // The late result goes through the same guard, so it happens once.
  assert.match(step, /\} else \{\s*if \(movedOn\) return;/);
  assert.doesNotMatch(step, /transaction-success/);
  const service = read("services/transaction.service.ts");
  assert.match(service, /onSubmitted: \(\) => \{\s*accepted = true;\s*request\.onAccepted\?\.\(transactionId\);/);
  // A failure after the screen moved on is raised as an alert.
  assert.match(service, /if \(accepted\) \{/);
  assert.match(read("app/transaction-success.tsx"), /describeOutcome\(transaction\.status, transaction\.error\)/);
});
