const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const { Wallet } = require("ethers");
const {
  assertAuthMessageMatches,
  parseAuthMessage,
  verifySignature,
} = require("../utils/signatureVerifier.ts");

const buildMessage = ({
  wallet,
  purpose = "login",
  domain = "atara.finance",
  chainId = 84532,
  nonce = "a".repeat(64),
}) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  return [
    "ATARA authentication",
    `Domain: ${domain}`,
    `Chain: ${chainId}`,
    `Wallet: ${wallet}`,
    `Purpose: ${purpose === "login" ? "Login" : "Register"}`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
  ].join("\n");
};

test("accepts a strict ATARA challenge signed by its wallet", async () => {
  const wallet = Wallet.createRandom();
  const message = buildMessage({ wallet: wallet.address });
  const signature = await wallet.signMessage(message);

  const parsed = assertAuthMessageMatches({
    message,
    signerAddress: wallet.address,
    purpose: "login",
    domain: "atara.finance",
    chainId: 84532,
  });

  assert.equal(parsed.wallet, wallet.address.toLowerCase());
  assert.equal(verifySignature(message, signature, wallet.address), true);
});

test("rejects a registration challenge reused for login", () => {
  const wallet = Wallet.createRandom();
  const message = buildMessage({ wallet: wallet.address, purpose: "register" });

  assert.throws(
    () =>
      assertAuthMessageMatches({
        message,
        signerAddress: wallet.address,
        purpose: "login",
        domain: "atara.finance",
        chainId: 84532,
      }),
    /Authentication challenge does not match/,
  );
});

test("rejects a challenge for another ATARA domain", () => {
  const wallet = Wallet.createRandom();
  const message = buildMessage({ wallet: wallet.address, domain: "evil.example" });

  assert.throws(
    () =>
      assertAuthMessageMatches({
        message,
        signerAddress: wallet.address,
        purpose: "login",
        domain: "atara.finance",
        chainId: 84532,
      }),
    /Authentication challenge does not match/,
  );
});

test("rejects a challenge containing a different wallet", () => {
  const signer = Wallet.createRandom();
  const claimed = Wallet.createRandom();
  const message = buildMessage({ wallet: signer.address });

  assert.throws(
    () =>
      assertAuthMessageMatches({
        message,
        signerAddress: claimed.address,
        purpose: "login",
        domain: "atara.finance",
        chainId: 84532,
      }),
    /Authentication challenge does not match/,
  );
});

test("rejects malformed or extra challenge lines", () => {
  const wallet = Wallet.createRandom();
  const message = `${buildMessage({ wallet: wallet.address })}\nUnexpected: field`;
  assert.throws(() => parseAuthMessage(message), /Invalid authentication message/);
});
