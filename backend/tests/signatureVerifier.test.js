const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const { Wallet } = require("ethers");
const {
  verifyLoginSignature,
} = require("../utils/signatureVerifier.ts");

const createSignedMessage = async (wallet, action, timestamp = Date.now()) => {
  const message = `${action} to ATARA\nWallet: ${wallet.address}\nTimestamp: ${timestamp}`;
  const signature = await wallet.signMessage(message);

  return { message, signature };
};

test("accepts a fresh ATARA login message signed by its wallet", async () => {
  const wallet = Wallet.createRandom();
  const { message, signature } = await createSignedMessage(wallet, "Login");

  assert.doesNotThrow(() =>
    verifyLoginSignature(wallet.address, message, signature, "Login"),
  );
});

test("rejects a registration message reused for login", async () => {
  const wallet = Wallet.createRandom();
  const { message, signature } = await createSignedMessage(wallet, "Register");

  assert.throws(
    () => verifyLoginSignature(wallet.address, message, signature, "Login"),
    /Invalid authentication message/,
  );
});

test("rejects a message containing a different wallet", async () => {
  const signer = Wallet.createRandom();
  const claimedWallet = Wallet.createRandom();
  const { message, signature } = await createSignedMessage(signer, "Login");

  assert.throws(
    () =>
      verifyLoginSignature(
        claimedWallet.address,
        message,
        signature,
        "Login",
      ),
    /Invalid authentication message/,
  );
});

test("rejects an expired message", async () => {
  const wallet = Wallet.createRandom();
  const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
  const { message, signature } = await createSignedMessage(
    wallet,
    "Login",
    sixMinutesAgo,
  );

  assert.throws(
    () => verifyLoginSignature(wallet.address, message, signature, "Login"),
    /Login message expired/,
  );
});
