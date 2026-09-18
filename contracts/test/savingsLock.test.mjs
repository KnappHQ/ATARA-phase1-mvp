import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import fs from "node:fs";
import hre from "hardhat";
import { BrowserProvider, Contract, ContractFactory, ZeroAddress, ZeroHash, id } from "ethers";

let connection, provider, signers, addresses;
const units = (n) => BigInt(n) * 1_000_000n;
let depositSequence = 0;
const deposit = (lock, amount) => lock.deposit(amount, id(`deposit-${++depositSequence}`));
const artifact = (name) => JSON.parse(fs.readFileSync(new URL(`../artifacts/${name}.json`, import.meta.url), "utf8"));
async function deploy(name, args = [], signer = signers[0]) {
  const a = artifact(name);
  const result = await new ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args);
  await result.waitForDeployment();
  return result;
}
const mined = async (request) => (await request).wait();
const timestamp = async () => Number((await connection.provider.request({ method: "eth_getBlockByNumber", params: ["latest", false] })).timestamp);
async function warp(target) {
  await connection.provider.request({ method: "evm_setNextBlockTimestamp", params: [target] });
  await connection.provider.request({ method: "evm_mine", params: [] });
}
async function fixture(tokenName = "TestUSDC") {
  const token = await deploy(tokenName);
  const factory = await deploy("AtaraSavingsLockFactory", [await token.getAddress()]);
  const unlockAt = await timestamp() + 3600;
  await mined(factory.createSavingsLock("Projet", unlockAt, ZeroHash));
  const [list] = await factory.getSavingsLocks(addresses[0], 0, 20);
  const lock = new Contract(list[0], artifact("AtaraSavingsLock").abi, signers[0]);
  await mined(token.mint(addresses[0], units(20_000)));
  await mined(token.approve(list[0], units(20_000)));
  return { token, factory, lock, unlockAt };
}

before(async () => {
  connection = await hre.network.connect("vaultTest");
  provider = new BrowserProvider(connection.provider, undefined, { cacheTimeout: -1 });
  signers = await Promise.all(Array.from({ length: 4 }, (_, i) => provider.getSigner(i)));
  addresses = await Promise.all(signers.map((s) => s.getAddress()));
});
after(async () => { await connection?.close(); });

test("rejects terms a lock could not honour", async () => {
  const { factory, unlockAt } = await fixture();
  await Promise.all([
    factory.createSavingsLock("", unlockAt, id("empty")),
    factory.createSavingsLock("x".repeat(65), unlockAt, id("long")),
    factory.createSavingsLock("Projet", 0, id("past")),
    factory.createSavingsLock("Projet", await timestamp() + 60, id("tooSoon")),
    factory.createSavingsLock("Projet", await timestamp() + 400 * 86400, id("tooFar")),
  ].map((p) => assert.rejects(p)));
});

test("the owner is the creator, and the factory keeps no control", async () => {
  const { factory, lock } = await fixture();
  assert.equal(await lock.owner(), addresses[0]);
  assert.equal(await factory.isSavingsLock(await lock.getAddress()), true);
  // Nothing on the factory can move a deployed lock's funds: the ABI offers no
  // such entry point at all.
  const names = artifact("AtaraSavingsLockFactory").abi.filter((e) => e.type === "function").map((e) => e.name);
  assert.deepEqual(names.sort(), ["MAX_TOTAL_DEPOSITS", "createSavingsLock", "getSavingsLocks", "isSavingsLock", "lockByKey", "token"]);
});

test("create retry is idempotent but cannot substitute new terms", async () => {
  const { factory, lock, unlockAt } = await fixture();
  await mined(factory.createSavingsLock("Projet", unlockAt, ZeroHash));
  const [list, total] = await factory.getSavingsLocks(addresses[0], 0, 20);
  assert.equal(total, 1n);
  assert.equal(list[0], await lock.getAddress());
  await assert.rejects(factory.createSavingsLock("Autre", unlockAt, ZeroHash));
});

test("accepts deposits while open and refuses a replayed deposit id", async () => {
  const { lock } = await fixture();
  await mined(deposit(lock, units(100)));
  assert.equal(await lock.totalDeposited(), units(100));
  const once = id("same-id");
  await mined(lock.deposit(units(10), once));
  await assert.rejects(lock.deposit(units(10), once));
});

test("refuses a deposit above the cap", async () => {
  const { lock } = await fixture();
  await assert.rejects(deposit(lock, units(10_001)));
  await mined(deposit(lock, units(10_000)));
  await assert.rejects(deposit(lock, units(1)));
});

test("only the owner may deposit or withdraw", async () => {
  const { token, lock } = await fixture();
  const address = await lock.getAddress();
  await mined(token.mint(addresses[1], units(100)));
  await mined(token.connect(signers[1]).approve(address, units(100)));
  await assert.rejects(lock.connect(signers[1]).deposit(units(10), id("outsider")));
  await assert.rejects(lock.connect(signers[1]).withdraw(addresses[1], units(1)));
});

test("holds the money until the unlock date, then releases it", async () => {
  const { token, lock, unlockAt } = await fixture();
  await mined(deposit(lock, units(500)));

  // The whole point of the contract: before the date, not even the owner gets out.
  await assert.rejects(lock.withdraw(addresses[0], units(1)));

  await warp(unlockAt);
  const before = await token.balanceOf(addresses[0]);
  await mined(lock.withdraw(addresses[0], units(500)));
  assert.equal(await token.balanceOf(addresses[0]) - before, units(500));
  assert.equal(await lock.totalWithdrawn(), units(500));
});

test("funding closes at the unlock date", async () => {
  const { lock, unlockAt } = await fixture();
  await mined(deposit(lock, units(10)));
  await warp(unlockAt);
  await assert.rejects(deposit(lock, units(10)));
});

test("refuses to withdraw more than the balance, or to a degenerate recipient", async () => {
  const { token, lock, unlockAt } = await fixture();
  await mined(deposit(lock, units(50)));
  await warp(unlockAt);
  await assert.rejects(lock.withdraw(addresses[0], units(51)));
  await assert.rejects(lock.withdraw(addresses[0], 0));
  await assert.rejects(lock.withdraw(ZeroAddress, units(1)));
  await assert.rejects(lock.withdraw(await lock.getAddress(), units(1)));
  await assert.rejects(lock.withdraw(await token.getAddress(), units(1)));
});

test("a fee-on-transfer token cannot corrupt the accounting", async () => {
  const { token, lock } = await fixture("AdversarialToken");
  await mined(token.configure(false, true, ZeroAddress, "0x"));
  await assert.rejects(deposit(lock, units(10)));
  assert.equal(await lock.totalDeposited(), 0n);
});

test("the snapshot reports what the screen needs", async () => {
  const { lock, unlockAt } = await fixture();
  await mined(deposit(lock, units(250)));
  const s = await lock.snapshot();
  assert.equal(s.name, "Projet");
  assert.equal(s.owner, addresses[0]);
  assert.equal(s.unlockAt, BigInt(unlockAt));
  assert.equal(s.balance, units(250));
  assert.equal(s.totalDeposited, units(250));
  assert.equal(s.totalWithdrawn, 0n);
  assert.equal(s.maxTotalDeposits, units(10_000));
  assert.ok(s.chainTimestamp < BigInt(unlockAt));
});
