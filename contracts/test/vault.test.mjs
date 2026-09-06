import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import fs from "node:fs";
import hre from "hardhat";
import { BrowserProvider, Contract, ContractFactory, ZeroAddress, ZeroHash, id } from "ethers";

let connection, provider, signers, addresses;
const units = (n) => BigInt(n) * 1_000_000n;
let depositSequence = 0;
const deposit = (vault, amount) => vault.deposit(amount, id(`deposit-${++depositSequence}`));
const propose = async (vault, recipient, amount) => vault.proposeWithdrawal(recipient, amount, await vault.proposalId() + 1n);
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
async function fixture(count = 3, tokenName = "TestUSDC") {
  const token = await deploy(tokenName);
  const factory = await deploy("AtaraVaultFactory", [await token.getAddress()]);
  const unlockAt = await timestamp() + 3600;
  const members = addresses.slice(0, count);
  await mined(factory.createVault("Holiday", members, unlockAt, ZeroHash));
  const [list] = await factory.getVaults(members[0], 0, 20);
  const vault = new Contract(list[0], artifact("AtaraGroupVault").abi, signers[0]);
  for (let i = 0; i < count; i++) {
    await mined(token.mint(members[i], units(20_000)));
    await mined(token.connect(signers[i]).approve(list[0], units(20_000)));
  }
  const acceptAll = async () => { for (let i = 0; i < count; i++) await mined(vault.connect(signers[i]).acceptTerms()); };
  const approveAll = async () => { const n = await vault.proposalId(); for (let i = 0; i < count; i++) await mined(vault.connect(signers[i]).setApproval(n, true)); };
  return { token, factory, vault, unlockAt, members, acceptAll, approveAll };
}

before(async () => {
  connection = await hre.network.connect("vaultTest");
  provider = new BrowserProvider(connection.provider, undefined, { cacheTimeout: -1 });
  signers = await Promise.all(Array.from({ length: 12 }, (_, i) => provider.getSigner(i)));
  addresses = await Promise.all(signers.map((s) => s.getAddress()));
});
after(async () => { await connection?.close(); });

test("validates immutable terms and requires the creator among unique members", async () => {
  const { factory, unlockAt } = await fixture();
  const rejects = [
    factory.createVault("X", [addresses[0]], unlockAt, id("one")),
    factory.createVault("X", [addresses[0], addresses[0]], unlockAt, id("dup")),
    factory.createVault("X", [addresses[0], ZeroAddress], unlockAt, id("zero")),
    factory.createVault("X", addresses.slice(0, 11), unlockAt, id("eleven")),
    factory.createVault("X", addresses.slice(1, 3), unlockAt, id("outsider")),
    factory.createVault("", addresses.slice(0, 3), unlockAt, id("empty")),
    factory.createVault("X", addresses.slice(0, 3), 0, id("past")),
  ];
  await Promise.all(rejects.map((p) => assert.rejects(p)));
});

test("create retry is idempotent but cannot substitute new terms", async () => {
  const { factory, vault, unlockAt, members } = await fixture();
  await mined(factory.createVault("Holiday", members, unlockAt, ZeroHash));
  const [list, total] = await factory.getVaults(members[0], 0, 20);
  assert.equal(total, 1n);
  assert.equal(list[0], await vault.getAddress());
  await assert.rejects(factory.createVault("Different", members, unlockAt, ZeroHash));
  await assert.rejects(factory.getVaults(members[0], 0, 21));
  assert.equal((await factory.getVaults(members[0], 20, 20))[0].length, 0);
});

test("requires every member's acceptance before any deposit", async () => {
  const { vault, token } = await fixture();
  await assert.rejects(deposit(vault, units(50)));
  await mined(vault.acceptTerms());
  await assert.rejects(vault.acceptTerms());
  await assert.rejects(vault.connect(signers[8]).acceptTerms());
  await mined(vault.connect(signers[1]).acceptTerms());
  await assert.rejects(deposit(vault, units(50)));
  await mined(vault.connect(signers[2]).acceptTerms());
  await mined(deposit(vault, units(50)));
  assert.equal(await token.balanceOf(await vault.getAddress()), units(50));
  assert.equal(await vault.contributions(addresses[0]), units(50));
});

test("enforces amounts, the lifetime deposit cap and the exact unlock boundary", async () => {
  const { vault, unlockAt, acceptAll } = await fixture();
  await acceptAll();
  await assert.rejects(deposit(vault, 0));
  await assert.rejects(deposit(vault, units(10_001)));
  await mined(deposit(vault, units(10_000)));
  await assert.rejects(deposit(vault, 1));
  await assert.rejects(propose(vault, addresses[5], 1));
  await warp(unlockAt);
  await assert.rejects(deposit(vault, 1));
  await mined(propose(vault, addresses[5], 1));
  assert.equal((await vault.snapshot()).proposal.approvalCount, 0n);
});

test("pays the exact recipient once only after all approvals, including the creator", async () => {
  const { vault, token, unlockAt, acceptAll, approveAll } = await fixture(5);
  await acceptAll();
  await mined(deposit(vault, units(100)));
  await warp(unlockAt);
  await mined(propose(vault, addresses[9], units(80)));
  await assert.rejects(vault.executeWithdrawal(1));
  await mined(vault.setApproval(1, true));
  await assert.rejects(vault.setApproval(1, true));
  await mined(vault.setApproval(1, false));
  await approveAll();
  await mined(vault.connect(signers[4]).setApproval(1, false));
  await assert.rejects(vault.executeWithdrawal(1));
  await mined(vault.connect(signers[4]).setApproval(1, true));
  await assert.rejects(vault.connect(signers[8]).executeWithdrawal(1));
  await mined(vault.connect(signers[3]).executeWithdrawal(1));
  assert.equal(await token.balanceOf(addresses[9]), units(80));
  assert.equal(await token.balanceOf(await vault.getAddress()), units(20));
  await assert.rejects(vault.executeWithdrawal(1));
  await mined(propose(vault, addresses[9], units(20)));
  assert.equal((await vault.proposal()).approvalCount, 0n);
  await assert.rejects(vault.setApproval(1, true));
  await approveAll();
  await mined(vault.executeWithdrawal(2));
  assert.equal(await token.balanceOf(addresses[9]), units(100));
});

test("expiration and cancellation never turn absent votes into consent", async () => {
  const { vault, unlockAt, acceptAll } = await fixture();
  await acceptAll(); await mined(deposit(vault, units(50))); await warp(unlockAt);
  await mined(propose(vault, addresses[8], units(25)));
  await mined(vault.setApproval(1, true));
  await assert.rejects(propose(vault, addresses[7], units(25)));
  await warp(Number((await vault.proposal()).expiresAt));
  await assert.rejects(vault.executeWithdrawal(1));
  await assert.rejects(vault.setApproval(1, true));
  await mined(propose(vault, addresses[7], units(20)));
  assert.equal((await vault.proposal()).approvalCount, 0n);
  await mined(vault.connect(signers[2]).cancelProposal(2));
  await assert.rejects(vault.setApproval(2, true));
  await assert.rejects(vault.executeWithdrawal(2));
});

test("a smart account can accept, deposit and approve; its owner has no separate vote", async () => {
  const token = await deploy("TestUSDC");
  const account = await deploy("TestSmartAccount");
  const accountAddress = await account.getAddress();
  const factory = await deploy("AtaraVaultFactory", [await token.getAddress()]);
  const unlockAt = await timestamp() + 3600;
  const data = factory.interface.encodeFunctionData("createVault", ["Family", [accountAddress, addresses[1]], unlockAt, ZeroHash]);
  await mined(account.execute(await factory.getAddress(), data));
  const [list] = await factory.getVaults(accountAddress, 0, 20);
  const vault = new Contract(list[0], artifact("AtaraGroupVault").abi, signers[1]);
  const call = async (name, args = []) => mined(account.execute(list[0], vault.interface.encodeFunctionData(name, args)));
  await call("acceptTerms"); await mined(vault.acceptTerms());
  await assert.rejects(vault.connect(signers[0]).acceptTerms());
  await mined(token.mint(accountAddress, units(12)));
  await mined(account.execute(await token.getAddress(), token.interface.encodeFunctionData("approve", [list[0], units(12)])));
  await call("deposit", [units(12), ZeroHash]); await warp(unlockAt);
  await mined(propose(vault, addresses[3], units(12)));
  await mined(vault.setApproval(1, true)); await call("setApproval", [1, true]);
  await mined(vault.executeWithdrawal(1));
  assert.equal(await token.balanceOf(addresses[3]), units(12));
});

test("failed or fee-on-transfer tokens cannot alter the ledger", async () => {
  const { vault, token, acceptAll } = await fixture(3, "AdversarialToken");
  await acceptAll();
  await mined(token.configure(true, false, ZeroAddress, "0x"));
  await assert.rejects(deposit(vault, units(10)));
  await mined(token.configure(false, true, ZeroAddress, "0x"));
  await assert.rejects(deposit(vault, units(10)));
  assert.equal(await vault.totalDeposited(), 0n);
  assert.equal(await token.balanceOf(await vault.getAddress()), 0n);
});

test("reentrant execution cannot double spend, even when the token is also a member", async () => {
  const token = await deploy("AdversarialToken");
  const tokenAddress = await token.getAddress();
  const unlockAt = await timestamp() + 3600;
  const vault = await deploy("AtaraGroupVault", [tokenAddress, "Attack", [addresses[0], tokenAddress], unlockAt, units(100)]);
  const v = await vault.getAddress();
  await mined(vault.acceptTerms());
  await mined(token.asMember(v, vault.interface.encodeFunctionData("acceptTerms")));
  await mined(token.mint(addresses[0], units(100))); await mined(token.approve(v, units(100)));
  await mined(deposit(vault, units(100))); await warp(unlockAt);
  await mined(propose(vault, addresses[6], units(30)));
  await mined(vault.setApproval(1, true));
  await mined(token.asMember(v, vault.interface.encodeFunctionData("setApproval", [1, true])));
  await mined(token.configure(false, false, v, vault.interface.encodeFunctionData("executeWithdrawal", [1])));
  await mined(vault.executeWithdrawal(1));
  assert.equal(await token.callbackSucceeded(), false);
  assert.equal(await token.balanceOf(v), units(70));
});

test("seeded varied payouts conserve assets and cannot reuse a previous proposal", async () => {
  const { vault, token, unlockAt, acceptAll, approveAll } = await fixture();
  await acceptAll(); await mined(deposit(vault, units(900))); await warp(unlockAt);
  let paid = 0n, seed = 42;
  for (let i = 0; i < 12; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const amount = units(1 + seed % 20);
    await mined(propose(vault, addresses[9], amount));
    await approveAll(); await mined(vault.executeWithdrawal(i + 1)); paid += amount;
    assert.equal(await token.balanceOf(await vault.getAddress()) + paid, units(900));
    await assert.rejects(vault.executeWithdrawal(i + 1));
  }
});

test("lost-response retries cannot duplicate a deposit or create a later proposal", async () => {
  const { vault, unlockAt, acceptAll } = await fixture();
  await acceptAll();
  await mined(vault.deposit(units(30), id("retry")));
  await assert.rejects(vault.deposit(units(30), id("retry")));
  assert.equal(await vault.totalDeposited(), units(30));
  await warp(unlockAt);
  await mined(vault.proposeWithdrawal(addresses[9], units(10), 1));
  await mined(vault.cancelProposal(1));
  await assert.rejects(vault.proposeWithdrawal(addresses[9], units(10), 1));
  assert.equal(await vault.proposalId(), 1n);
});

test("unanimous cancellation refunds each member's recorded share exactly once", async () => {
  const { vault, token, acceptAll } = await fixture();
  await acceptAll();
  await mined(vault.deposit(units(50), id("refund-0")));
  await mined(vault.connect(signers[1]).deposit(units(30), id("refund-1")));
  await mined(vault.connect(signers[2]).deposit(units(20), id("refund-2")));

  const before = await Promise.all(addresses.slice(0, 3).map((address) => token.balanceOf(address)));
  await assert.rejects(vault.cancelVault());
  for (let i = 0; i < 3; i++) await mined(vault.connect(signers[i]).setCancellationApproval(true));
  await mined(vault.cancelVault());

  const after = await Promise.all(addresses.slice(0, 3).map((address) => token.balanceOf(address)));
  assert.deepEqual(after.map((value, i) => value - before[i]), [units(50), units(30), units(20)]);
  assert.equal(await token.balanceOf(await vault.getAddress()), 0n);
  assert.equal(await vault.totalDeposited(), 0n);
  assert.equal(await vault.cancelled(), true);
  await assert.rejects(vault.cancelVault());
  await assert.rejects(vault.deposit(units(1), id("after-cancel")));
});
