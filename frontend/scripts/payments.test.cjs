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
const source = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

const { groupAddress } = load("utils/paymentReview.ts");

test("the review shows every character of the address, in groups of four", () => {
  const address = "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01";
  const grouped = groupAddress(address);
  assert.equal(grouped.replace(/\s/g, ""), address);
  assert.equal(grouped, "0x AbCd Ef01 2345 6789 aBcD eF01 2345 6789 AbCd Ef01");
});

test("the review never truncates the recipient address", () => {
  const review = source("components/send/PaymentReview.tsx");
  assert.doesNotMatch(review, /numberOfLines/);
  assert.match(review, /Recipient receives/);
  assert.match(review, /Network fee/);
  assert.match(review, /Leaves your account/);
});

test("sending and paying a merchant both go through the same review", () => {
  assert.match(source("components/send/AmountStep.tsx"), /<PaymentReview/);
  const merchant = source("app/pay-merchant.tsx");
  assert.match(merchant, /<PaymentReview/);
  assert.match(merchant, /onPress=\{openReview\}/);
});

test("a merchant payment carries no note the payer did not write", () => {
  assert.doesNotMatch(source("app/pay-merchant.tsx"), /useState\("Groceries"\)/);
});

test("an unconfirmed payment keeps a warning and blocks sending again", () => {
  const amountStep = source("components/send/AmountStep.tsx");
  assert.match(amountStep, /if \(result\.isPendingVerification\) setStatusUnknown\(true\)/);
  assert.match(amountStep, /!statusUnknown &&/);
  assert.match(amountStep, /Status unknown\. Do not send again\./);
});

test("a group quote that expired while the review was open is not paid", () => {
  const amountStep = source("components/send/AmountStep.tsx");
  const confirm = amountStep.slice(amountStep.indexOf("const handleConfirmAddressAndSend"));
  assert.ok(
    confirm.indexOf("settlementNeedsUpdate()") < confirm.indexOf("transactionService.sendTransaction"),
    "the quote is re-checked before the payment is sent",
  );
});
