const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/**
 * Loads a TypeScript module the way the other script tests do. Relative imports
 * are compiled too; anything else must be provided in `mocks`.
 */
const load = (relativePath, mocks = {}, cache = {}) => {
  const file = path.join(__dirname, "..", relativePath);
  if (cache[file]) return cache[file];
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  cache[file] = exports;
  const localRequire = (specifier) => {
    if (specifier in mocks) return mocks[specifier];
    if (!specifier.startsWith(".")) throw new Error(`Unexpected import ${specifier}`);
    const target = path.relative(path.join(__dirname, ".."), path.join(path.dirname(file), specifier));
    return load(`${target}.ts`, mocks, cache);
  };
  new Function("exports", "require", code)(exports, localRequire);
  return exports;
};

const labels = load("utils/accountLabels.ts");
const options = load("utils/passkeyOptions.ts");
const methods = load("utils/loginMethods.ts");
const registry = load("utils/accountRegistry.ts");
const deletion = load("utils/accountDeletion.ts");
const service = load("services/passkey.service.ts");

const NOW = 1_800_000_000_000;
const bytes = (...values) => Uint8Array.from(values);

// ---------------------------------------------------------------- names

test("a name is printable, single-spaced and bounded", () => {
  assert.equal(labels.normalizeAccountLabel("  Tanguy \n  —\tPersonnel  "), "Tanguy — Personnel");
  // A bidirectional override could make one label read as another in a list.
  assert.equal(labels.normalizeAccountLabel("Test‮gnirps"), "Testgnirps");
  assert.equal(labels.normalizeAccountLabel("a​b\u0000c"), "abc");
  assert.equal(labels.normalizeAccountLabel("x".repeat(80)).length, labels.MAX_ACCOUNT_LABEL_LENGTH);
});

test("two accounts on one phone cannot be given the same name", () => {
  const others = ["Tanguy — Personnel"];
  assert.deepEqual(labels.checkAccountLabel("Tanguy — Tests", others), { ok: true, label: "Tanguy — Tests" });
  assert.equal(labels.checkAccountLabel("   ", others).reason, "empty");
  assert.equal(labels.checkAccountLabel("x".repeat(41), others).reason, "too-long");
  // Case, accents and spacing do not make a name different.
  for (const same of ["tanguy — personnel", "TANGUY  —  PERSONNEL", "Tânguy — Personnel"]) {
    assert.equal(labels.checkAccountLabel(same, others).reason, "duplicate", same);
  }
});

test("the suggested name is the @handle, or a short unambiguous code", () => {
  assert.equal(labels.suggestAccountLabel({ handle: "tanguy41", taken: [], bytes: bytes(0) }), "@tanguy41");
  assert.equal(labels.suggestAccountLabel({ handle: "@tanguy41", taken: [], bytes: bytes(0) }), "@tanguy41");

  const code = labels.accountCodeFromBytes(bytes(0, 1, 2, 3));
  assert.match(code, /^[A-HJKMNP-Z2-9]{4}$/);
  assert.equal(labels.suggestAccountLabel({ taken: [], bytes: bytes(0, 1, 2, 3) }), `Account ${code}`);
  // The alphabet has no 0, O, 1, I or L.
  for (let b = 0; b < 256; b++) assert.doesNotMatch(labels.accountCodeFromBytes(bytes(b, b, b, b)), /[01OIL]/);

  // A taken name gets a number rather than a duplicate.
  assert.equal(labels.suggestAccountLabel({ handle: "tanguy41", taken: ["@Tanguy41"], bytes: bytes(0) }), "@tanguy41 2");
});

// ------------------------------------------------- options given to iOS

const privyOptions = () => ({
  challenge: "Y2hhbGxlbmdl",
  pub_key_cred_params: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
  rp: { id: "api.atara.finance", name: "ATARA" },
  user: { id: "dXNlci1oYW5kbGU", name: "ATARA", display_name: "ATARA" },
  authenticator_selection: {
    authenticator_attachment: "platform",
    resident_key: "required",
    user_verification: "required",
    require_resident_key: true,
  },
  exclude_credentials: [{ id: "b2xkLWNyZWQ", type: "public-key", transports: ["internal"] }],
});

test("only the name shown by iOS differs from what Privy asked for", () => {
  const given = privyOptions();
  const frozen = JSON.parse(JSON.stringify(given));
  const built = options.buildCreationOptions(given, "  Tanguy — Tests ");

  assert.deepEqual(given, frozen, "Privy's answer is not modified");
  assert.deepEqual(built.user, { id: "dXNlci1oYW5kbGU", name: "Tanguy — Tests", displayName: "Tanguy — Tests" });
  // The user handle and the exclusion list are what stop iOS replacing a passkey.
  assert.equal(built.user.id, given.user.id);
  assert.deepEqual(built.excludeCredentials, given.exclude_credentials);
  assert.equal(built.challenge, given.challenge);
  assert.deepEqual(built.rp, given.rp);
  assert.deepEqual(built.pubKeyCredParams, given.pub_key_cred_params);
  assert.deepEqual(built.authenticatorSelection, {
    authenticatorAttachment: "platform",
    residentKey: "required",
    userVerification: "required",
    requireResidentKey: true,
  });
  assert.equal(built.timeout, 120_000);
  assert.equal(built.attestation, undefined);
  assert.throws(() => options.buildCreationOptions(given, "  ​ "), /needs a name/);
});

test("a targeted sign-in offers only the chosen credential", () => {
  const auth = {
    challenge: "Y2g",
    rp_id: "api.atara.finance",
    allow_credentials: [],
    user_verification: "required",
  };
  const targeted = options.buildRequestOptions(auth, "ab+cd/ef==");
  assert.deepEqual(targeted.allowCredentials, [{ id: "ab-cd_ef", type: "public-key" }]);
  assert.equal(targeted.rpId, "api.atara.finance");
  assert.equal(targeted.challenge, "Y2g");
  assert.equal(targeted.timeout, 120_000);

  assert.deepEqual(options.buildRequestOptions(auth).allowCredentials, []);
});

test("credential ids match whichever base64 alphabet a source used", () => {
  assert.equal(options.normalizeCredentialId(" ab+cd/ef== "), "ab-cd_ef");
  assert.ok(options.sameCredential("ab+cd/ef==", "ab-cd_ef"));
  assert.ok(!options.sameCredential("ab-cd_ef", "ab-cd_eg"));
  assert.ok(!options.sameCredential(null, "ab"));
});

test("a challenge is base64url, byte for byte what Node produces", () => {
  for (const length of [30, 31, 32]) {
    const random = crypto.randomBytes(length);
    assert.equal(options.challengeFromBytes(random), random.toString("base64url"));
  }
});

// ----------------------------------------------------- the passkey flows

const RP = "https://api.atara.finance";
const CREATED = { id: "bmV3LWNyZWQ+/=", type: undefined, rawId: "x", response: { attestationObject: "a" } };

const fakes = (overrides = {}) => {
  const log = [];
  const client = {
    auth: {
      passkey: {
        generateSignupOptions: async (rp) => (log.push(["signup-options", rp]), { options: privyOptions() }),
        generateRegistrationOptions: async (rp) => (log.push(["link-options", rp]), { options: privyOptions() }),
        generateAuthenticationOptions: async (rp) => (
          log.push(["auth-options", rp]),
          { options: { challenge: "Y2g", rp_id: "api.atara.finance", allow_credentials: [], user_verification: "required" } }
        ),
        signupWithPasskey: async (input, rp) => (log.push(["signup", input, rp]), { user: { id: "did:privy:new", linked_accounts: [] } }),
        linkWithPasskey: async (input, rp) => (log.push(["link", input, rp]), { user: { id: "did:privy:old", linked_accounts: [] } }),
        loginWithPasskey: async (input, challenge, rp, opts) => (
          log.push(["login", input, challenge, rp, opts]),
          { user: { id: "did:privy:old", linked_accounts: [] } }
        ),
        ...overrides.client,
      },
    },
  };
  const passkeys = {
    create: async (request) => (log.push(["create", request]), CREATED),
    get: async (request) => (log.push(["get", request]), { id: "b2xkLWNyZWQ", type: "public-key" }),
    ...overrides.passkeys,
  };
  return { deps: { client, passkeys, randomBytes: () => crypto.randomBytes(32) }, log };
};
const step = (log, name) => log.find(([entry]) => entry === name);

test("a new account's passkey is named by its owner and handed to Privy unchanged", async () => {
  const { deps, log } = fakes();
  const created = await service.createNamedPasskey(deps, { mode: "signup", relyingParty: RP, label: "Tanguy — Tests" });

  assert.deepEqual(log.map(([name]) => name), ["signup-options", "create", "signup"]);
  const [, request] = step(log, "create");
  assert.equal(request.user.name, "Tanguy — Tests");
  assert.equal(request.user.id, "dXNlci1oYW5kbGU");
  const [, sent, rp] = step(log, "signup");
  assert.equal(rp, RP);
  assert.equal(sent.id, CREATED.id, "the credential Privy receives is the one iOS made");
  assert.equal(sent.type, "public-key");
  assert.deepEqual(sent.clientExtensionResults, {});

  assert.equal(created.user.id, "did:privy:new");
  assert.equal(created.credentialId, "bmV3LWNyZWQ-_", "stored in the normalized form");
  assert.equal(created.label, "Tanguy — Tests");
  assert.equal(created.proposedName, "ATARA", "what Privy proposed is kept for diagnostics");
});

test("adding a passkey to an account keeps the exclusion list that protects the old one", async () => {
  const { deps, log } = fakes();
  await service.createNamedPasskey(deps, { mode: "link", relyingParty: RP, label: "Tanguy — Backup" });
  assert.deepEqual(log.map(([name]) => name), ["link-options", "create", "link"]);
  assert.deepEqual(step(log, "create")[1].excludeCredentials, privyOptions().exclude_credentials);
});

test("a passkey iOS did not create leaves nothing behind and is never sent to Privy", async () => {
  for (const passkeys of [
    { create: async () => null },
    { create: async () => { throw new Error("User cancelled the passkey interaction"); } },
  ]) {
    const { deps, log } = fakes({ passkeys });
    await assert.rejects(
      service.createNamedPasskey(deps, { mode: "signup", relyingParty: RP, label: "Tanguy" }),
      (error) => {
        assert.equal(error.stage, "create");
        assert.equal(error.orphanedPasskeyName, undefined);
        return true;
      },
    );
    assert.equal(step(log, "signup"), undefined);
  }
  const { deps } = fakes({ passkeys: { create: async () => { throw new Error("User cancelled the passkey interaction"); } } });
  await assert.rejects(
    service.createNamedPasskey(deps, { mode: "signup", relyingParty: RP, label: "Tanguy" }),
    (error) => error.cancelled === true,
  );
});

test("a passkey Privy refused is reported, with its name, as left on the phone", async () => {
  const { deps } = fakes({ client: { signupWithPasskey: async () => { throw new Error("Network error"); } } });
  await assert.rejects(
    service.createNamedPasskey(deps, { mode: "signup", relyingParty: RP, label: "Tanguy — Tests" }),
    (error) => {
      assert.equal(error.stage, "link");
      assert.equal(error.orphanedPasskeyName, "Tanguy — Tests");
      assert.equal(error.cancelled, false);
      return true;
    },
  );
});

test("signing in with a chosen passkey offers only that credential", async () => {
  const { deps, log } = fakes();
  const embedded = { ethereum: { createOnLogin: "users-without-wallets" } };
  const signedIn = await service.signInWithPasskey(deps, { relyingParty: RP, credentialId: "b2xkLWNyZWQ", embedded });

  assert.deepEqual(step(log, "get")[1].allowCredentials, [{ id: "b2xkLWNyZWQ", type: "public-key" }]);
  const [, sent, challenge, rp, opts] = step(log, "login");
  assert.equal(sent.id, "b2xkLWNyZWQ");
  assert.equal(challenge, "Y2g");
  assert.equal(rp, RP);
  assert.deepEqual(opts, { embedded });
  assert.deepEqual(signedIn, { user: { id: "did:privy:old", linked_accounts: [] }, credentialId: "b2xkLWNyZWQ" });
});

test("no passkey found means no sign-in is attempted", async () => {
  const { deps, log } = fakes({ passkeys: { get: async () => null } });
  await assert.rejects(
    service.signInWithPasskey(deps, { relyingParty: RP, credentialId: "b2xkLWNyZWQ" }),
    (error) => error.stage === "sign-in",
  );
  assert.equal(step(log, "login"), undefined);
});

test("testing a passkey proves it on this phone without contacting Privy", async () => {
  const seen = [];
  const passkeys = { get: async (request) => (seen.push(request), { id: "b2xkLWNyZWQ" }) };
  // No client is passed: the test cannot reach Privy at all.
  const result = await service.testPasskey({ passkeys, randomBytes: () => crypto.randomBytes(32) }, {
    rpId: "api.atara.finance",
    credentialId: "b2xkLWNyZWQ",
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(seen[0].allowCredentials, [{ id: "b2xkLWNyZWQ", type: "public-key" }]);
  assert.equal(seen[0].userVerification, "required");
  assert.equal(seen[0].rpId, "api.atara.finance");
  assert.match(seen[0].challenge, /^[A-Za-z0-9_-]{43}$/);

  const failing = (error) => service.testPasskey(
    { passkeys: { get: async () => { throw error; } }, randomBytes: () => crypto.randomBytes(32) },
    { rpId: "api.atara.finance", credentialId: "b2xkLWNyZWQ" },
  );
  assert.equal((await failing(new Error("User cancelled the passkey interaction"))).reason, "cancelled");
  const missing = await failing(new Error("No credentials available"));
  assert.equal(missing.reason, "unavailable");
  assert.match(missing.message, /another device|deleted/);

  const other = await service.testPasskey(
    { passkeys: { get: async () => ({ id: "ZGlmZmVyZW50" }) }, randomBytes: () => crypto.randomBytes(32) },
    { rpId: "api.atara.finance", credentialId: "b2xkLWNyZWQ" },
  );
  assert.equal(other.ok, false);
});

// ----------------------------------------------------- sign-in methods

const passkeyAccount = (id, extra = {}) => ({
  type: "passkey",
  credential_id: id,
  enrolled_in_mfa: false,
  first_verified_at: 1_790_000_000,
  latest_verified_at: 1_790_000_100,
  ...extra,
});
const embeddedWallet = { type: "wallet", wallet_client_type: "privy", connector_type: "embedded", chain_type: "ethereum", address: "0x1" };

test("only sign-in methods this app offers are counted", () => {
  const user = { linked_accounts: [
    embeddedWallet,
    { type: "email", address: "a@b.c" },
    { type: "phone", phoneNumber: "+33" },
    { type: "smart_wallet" },
    passkeyAccount("AAAA"),
    { type: "google_oauth", email: "a@b.c" },
    { type: "apple_oauth" },
  ] };
  assert.deepEqual(methods.listLoginMethods(user).map((m) => `${m.kind}:${m.id}`), ["passkey:AAAA", "google:google", "apple:apple"]);
  assert.deepEqual(methods.listLoginMethods(null), []);

  const [summary] = methods.listPasskeys({ linked_accounts: [passkeyAccount("AA+/==", {
    authenticator_name: "iCloud Keychain",
    created_with_device: "iPhone",
    created_with_os: "iOS",
    enrolled_in_mfa: true,
  })] });
  assert.deepEqual(summary, {
    credentialId: "AA-_",
    authenticatorName: "iCloud Keychain",
    device: "iPhone",
    os: "iOS",
    browser: undefined,
    firstVerifiedAt: 1_790_000_000,
    latestVerifiedAt: 1_790_000_100,
    enrolledInMfa: true,
  });
});

test("the last way to sign in cannot be removed, even with a wallet and an email linked", () => {
  const user = { linked_accounts: [embeddedWallet, { type: "email", address: "a@b.c" }, passkeyAccount("AAAA")] };
  const verdict = methods.assessPasskeyRemoval({ user, credentialId: "AAAA", verifiedCredentialIds: ["AAAA"] });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, "last-method");
});

test("a second passkey that was never checked on this phone does not make removal safe", () => {
  const user = { linked_accounts: [passkeyAccount("AAAA"), passkeyAccount("BBBB")] };
  const untested = methods.assessPasskeyRemoval({ user, credentialId: "AAAA", verifiedCredentialIds: ["AAAA"] });
  assert.equal(untested.allowed, false);
  assert.equal(untested.reason, "untested-alternative");
  assert.equal(untested.alternatives.length, 1);

  const tested = methods.assessPasskeyRemoval({ user, credentialId: "AAAA", verifiedCredentialIds: ["BBBB"] });
  assert.equal(tested.allowed, true);
});

test("a Google or Apple account counts as a way in; an unknown passkey is refused", () => {
  const user = { linked_accounts: [passkeyAccount("AAAA"), { type: "apple_oauth" }] };
  assert.equal(methods.assessPasskeyRemoval({ user, credentialId: "AAAA", verifiedCredentialIds: [] }).allowed, true);
  assert.equal(methods.assessPasskeyRemoval({ user, credentialId: "ZZZZ", verifiedCredentialIds: [] }).reason, "not-linked");
});

test("verified credentials are matched across base64 spellings", () => {
  const user = { linked_accounts: [passkeyAccount("AA+/"), passkeyAccount("BB+/")] };
  const verdict = methods.assessPasskeyRemoval({ user, credentialId: "AA-_", verifiedCredentialIds: ["BB+/=="] });
  assert.equal(verdict.allowed, true);
});

// ----------------------------------------------------------- the registry

const empty = registry.emptyRegistry();

test("an account created by signup is completed by its Privy id, not by its name", () => {
  let state = registry.beginPendingAccount(empty, {
    key: "acct_1", privyUserId: "did:privy:new", label: "Tanguy — Tests", credentialId: "AAAA+/==", now: NOW,
  });
  assert.equal(state.accounts.length, 1);
  assert.equal(state.accounts[0].userId, null, "no profile yet");
  assert.equal(state.accounts[0].handle, null);

  // The profile is registered: a different name-like value must not matter.
  state = registry.recordSignIn(state, {
    key: "acct_ignored", bytes: bytes(1, 2, 3, 4),
    privyUserId: "did:privy:new", userId: "user-1", handle: "tanguy41",
    smartAccountAddress: "0x1234567890abcdef1234567890abcdef12345678", authProvider: "passkey",
    passkeys: [{ credentialId: "AAAA-_", enrolledInMfa: false, firstVerifiedAt: null }], now: NOW + 5,
  });
  assert.equal(state.accounts.length, 1, "bound to the pending entry, not duplicated");
  const [account] = state.accounts;
  assert.equal(account.key, "acct_1");
  assert.equal(account.userId, "user-1");
  assert.equal(account.handle, "tanguy41");
  assert.equal(account.label, "Tanguy — Tests", "the owner's name is kept");
  assert.deepEqual(account.passkeys.map((p) => [p.credentialId, p.name, p.origin]), [["AAAA-_", "Tanguy — Tests", "atara"]]);
});

test("accounts sharing a name are still told apart by their identifiers", () => {
  let state = registry.recordSignIn(empty, { key: "a", bytes: bytes(0), privyUserId: "did:privy:a", userId: "user-a", handle: "alice", now: NOW });
  state = registry.recordSignIn(state, { key: "b", bytes: bytes(0), privyUserId: "did:privy:b", userId: "user-b", handle: "bob", now: NOW });
  // Two entries end up with the same private name (an older list, a restore).
  const clash = { ...state, accounts: state.accounts.map((account) => ({ ...account, label: "Personal", labelSource: "user" })) };

  assert.equal(registry.findAccount(clash, { privyUserId: "did:privy:b" }).handle, "bob");
  assert.equal(registry.findAccount(clash, { userId: "user-a" }).handle, "alice");
  assert.equal(registry.findAccount(clash, { privyUserId: "did:privy:zzz" }), undefined);
  assert.deepEqual(clash.accounts.map((a) => registry.displayLabel(a, clash.accounts)), ["Personal · @alice", "Personal · @bob"]);
  assert.equal(registry.displayLabel(clash.accounts[0], [clash.accounts[0]]), "Personal");
});

test("the Privy user id outranks the ATARA id when they disagree", () => {
  let state = registry.recordSignIn(empty, { key: "a", bytes: bytes(0), privyUserId: "did:privy:a", userId: "user-old", handle: "alice", now: NOW });
  // The profile was deleted and registered again: same Privy user, new ATARA id.
  state = registry.recordSignIn(state, { key: "x", bytes: bytes(0), privyUserId: "did:privy:a", userId: "user-new", handle: "alice2", now: NOW + 1 });
  assert.equal(state.accounts.length, 1);
  assert.equal(state.accounts[0].userId, "user-new");
});

test("an automatic name follows the @handle; a chosen name never changes", () => {
  let state = registry.recordSignIn(empty, { key: "a", bytes: bytes(1, 2, 3, 4), privyUserId: "did:privy:a", userId: null, now: NOW });
  assert.match(state.accounts[0].label, /^Account [A-Z2-9]{4}$/);
  assert.equal(state.accounts[0].labelSource, "auto");

  state = registry.recordSignIn(state, { key: "a", bytes: bytes(1, 2, 3, 4), privyUserId: "did:privy:a", userId: "user-a", handle: "alice", now: NOW + 1 });
  assert.equal(state.accounts[0].label, "@alice");

  state = registry.renameAccount(state, "a", "Alice — Savings").state;
  state = registry.recordSignIn(state, { key: "a", bytes: bytes(9), privyUserId: "did:privy:a", userId: "user-a", handle: "alice_new", now: NOW + 2 });
  assert.equal(state.accounts[0].label, "Alice — Savings");
  assert.equal(state.accounts[0].handle, "alice_new");
});

test("renaming is checked, and a refused name changes nothing", () => {
  let state = registry.recordSignIn(empty, { key: "a", bytes: bytes(0), privyUserId: "did:privy:a", userId: "u-a", handle: "alice", now: NOW });
  state = registry.recordSignIn(state, { key: "b", bytes: bytes(0), privyUserId: "did:privy:b", userId: "u-b", handle: "bob", now: NOW });

  const refused = registry.renameAccount(state, "b", "  @ALICE ");
  assert.equal(refused.result.reason, "duplicate");
  assert.equal(refused.state, state, "same object: nothing was touched");
  assert.equal(registry.renameAccount(state, "b", "").result.reason, "empty");
  assert.equal(registry.renameAccount(state, "nope", "Work").result.reason, "unknown-account");

  const done = registry.renameAccount(state, "b", " Bob — Work ");
  assert.equal(done.result.ok, true);
  assert.equal(done.state.accounts[1].label, "Bob — Work");
  assert.equal(done.state.accounts[1].labelSource, "user");
  // Keeping an account's own name when re-saving it is not a duplicate.
  assert.equal(registry.renameAccount(done.state, "b", "bob — work").result.ok, true);
});

test("the list survives a restart, and damaged entries do not", () => {
  let state = registry.beginPendingAccount(empty, { key: "acct_1", privyUserId: "did:privy:a", label: "Tanguy — Tests", credentialId: "AAAA", now: NOW });
  state = registry.recordSignIn(state, { key: "x", bytes: bytes(0), privyUserId: "did:privy:a", userId: "u-a", handle: "tanguy41", smartAccountAddress: "0xabc", now: NOW + 1 });
  state = registry.renameAccount(state, "acct_1", "Tanguy — Renamed").state;

  const restarted = registry.sanitizeRegistry(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restarted, state);

  const damaged = registry.sanitizeRegistry({ accounts: [
    ...state.accounts,
    { key: "acct_1", label: "duplicate key" },
    { label: "no key" },
    null,
    { key: "z", label: "Z", passkeys: [{ credentialId: "ab+/==", name: 5 }, { nothing: true }], labelSource: "weird" },
  ] });
  assert.deepEqual(damaged.accounts.map((a) => a.key), ["acct_1", "z"]);
  assert.deepEqual(damaged.accounts[1].passkeys, [{ credentialId: "ab-_", name: null, createdAt: 0, verifiedAt: null, origin: "existing" }]);
  assert.equal(damaged.accounts[1].labelSource, "auto");
  assert.deepEqual(registry.sanitizeRegistry("garbage"), registry.emptyRegistry());
  assert.deepEqual(registry.sanitizeRegistry(undefined), registry.emptyRegistry());
});

test("Privy's list of passkeys is reflected: unknown ones added, removed ones dropped", () => {
  const records = [
    { credentialId: "KEEP", name: "Tanguy", createdAt: NOW - 86_400_000, verifiedAt: NOW - 1000, origin: "atara" },
    { credentialId: "GONE", name: null, createdAt: NOW - 86_400_000, verifiedAt: null, origin: "existing" },
    { credentialId: "FRESH", name: "Backup", createdAt: NOW - 60_000, verifiedAt: NOW - 60_000, origin: "atara" },
  ];
  const linked = [
    { credentialId: "KEEP", enrolledInMfa: false, firstVerifiedAt: 1 },
    { credentialId: "LEGACY", enrolledInMfa: false, firstVerifiedAt: 1_700_000_000 },
  ];
  const synced = registry.syncPasskeys(records, linked, NOW);
  assert.deepEqual(synced.map((p) => p.credentialId), ["KEEP", "FRESH", "LEGACY"],
    "GONE is dropped; FRESH is kept a while: Privy may not list it yet");
  const legacy = synced.find((p) => p.credentialId === "LEGACY");
  assert.deepEqual(legacy, { credentialId: "LEGACY", name: null, createdAt: 1_700_000_000_000, verifiedAt: null, origin: "existing" });
  assert.equal(synced[0].verifiedAt, NOW - 1000, "what was proven stays proven");

  const later = registry.syncPasskeys(records, linked, NOW + registry.NEW_PASSKEY_GRACE_MS + 1);
  assert.ok(!later.some((p) => p.credentialId === "FRESH"), "an unlisted passkey is not kept forever");
});

test("the credential used to sign in is remembered as proven on this phone", () => {
  let state = registry.recordSignIn(empty, {
    key: "a", bytes: bytes(0), privyUserId: "did:privy:a", userId: "u-a", handle: "alice",
    passkeys: [{ credentialId: "AA-_", enrolledInMfa: false, firstVerifiedAt: null }],
    usedCredentialId: "AA+/==", now: NOW,
  });
  assert.deepEqual(registry.verifiedCredentialIds(state.accounts[0]), ["AA-_"]);
  state = registry.markPasskeyVerified(state, "a", "AA-_", NOW + 10);
  assert.equal(state.accounts[0].passkeys[0].verifiedAt, NOW + 10);
  state = registry.removePasskeyRecord(state, "a", "AA-_");
  assert.deepEqual(state.accounts[0].passkeys, []);
  state = registry.addPasskeyRecord(state, "a", { credentialId: "BB", name: "Backup", now: NOW + 20 });
  assert.equal(state.accounts[0].passkeys[0].name, "Backup");
  assert.equal(registry.addPasskeyRecord(state, "a", { credentialId: "BB", name: "again", now: NOW + 30 }), state);
  assert.deepEqual(registry.passkeyNamesInUse(state), ["Backup"]);
});

test("forgetting one account leaves the others alone", () => {
  let state = registry.recordSignIn(empty, { key: "a", bytes: bytes(0), privyUserId: "did:privy:a", userId: "u-a", handle: "alice", now: NOW });
  state = registry.recordSignIn(state, { key: "b", bytes: bytes(0), privyUserId: "did:privy:b", userId: "u-b", handle: "bob", now: NOW });
  state = registry.recordSignIn(state, { key: "c", bytes: bytes(0), privyUserId: "did:privy:c", userId: "u-c", handle: "carol", now: NOW });
  const after = registry.removeAccount(state, "b");
  assert.deepEqual(after.accounts.map((a) => a.handle), ["alice", "carol"]);
  assert.equal(registry.removeAccount(after, "b").accounts.length, 2);
});

test("switching prefers a passkey proven on this phone, then the sign-in the account was made with", () => {
  const base = { key: "a", privyUserId: "p", userId: "u", handle: "h", smartAccountAddress: null, label: "L", labelSource: "user", createdAt: 1, lastUsedAt: 1 };
  const passkey = (credentialId, verifiedAt, createdAt = 1) => ({ credentialId, name: null, createdAt, verifiedAt, origin: "existing" });

  assert.deepEqual(registry.planSwitch({ ...base, authProvider: "google", passkeys: [passkey("OLD", 5), passkey("NEW", 9)] }),
    { method: "passkey", credentialId: "NEW" });
  assert.deepEqual(registry.planSwitch({ ...base, authProvider: "google", passkeys: [passkey("UNPROVEN", null)] }),
    { method: "oauth", provider: "google" });
  assert.deepEqual(registry.planSwitch({ ...base, authProvider: "passkey", passkeys: [passkey("A", null, 1), passkey("B", null, 7)] }),
    { method: "passkey", credentialId: "B" });
  assert.deepEqual(registry.planSwitch({ ...base, authProvider: null, passkeys: [] }), { method: "choose" });
});

// --------------------------------------- persistence with the real store

const memoryStorage = () => {
  const values = new Map();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const openStore = (storage) => load("stores/useAccountRegistryStore.ts", {
  zustand: require("zustand"),
  "zustand/middleware": require("zustand/middleware"),
  "@react-native-async-storage/async-storage": { default: storage },
}, {});

test("renaming an account, then restarting the app, keeps the name", async () => {
  const storage = memoryStorage();
  const first = openStore(storage);
  await first.registryReady();
  await first.useAccountRegistryStore.getState().beginPending({ key: "acct_1", privyUserId: "did:privy:a", label: "Tanguy — Tests", credentialId: "AAAA", now: NOW });
  await first.useAccountRegistryStore.getState().recordSignIn({ key: "x", bytes: bytes(0), privyUserId: "did:privy:a", userId: "u-a", handle: "tanguy41", now: NOW + 1 });
  assert.equal((await first.useAccountRegistryStore.getState().rename("acct_1", "Tanguy — Renamed")).ok, true);
  await settle();

  // A new module instance, as after the app is closed and reopened.
  const second = openStore(storage);
  assert.deepEqual(second.useAccountRegistryStore.getState().accounts, [], "nothing loaded before hydration");
  await second.registryReady();
  const [account] = second.useAccountRegistryStore.getState().accounts;
  assert.equal(account.label, "Tanguy — Renamed");
  assert.equal(account.handle, "tanguy41");
  assert.equal(account.userId, "u-a");
  assert.deepEqual(account.passkeys.map((p) => p.name), ["Tanguy — Tests"]);

  // Removing an account is remembered too.
  await second.useAccountRegistryStore.getState().remove("acct_1");
  await settle();
  const third = openStore(storage);
  await third.registryReady();
  assert.deepEqual(third.useAccountRegistryStore.getState().accounts, []);
});

test("a write made before the stored list loads is not lost", async () => {
  const storage = memoryStorage();
  const seed = openStore(storage);
  await seed.registryReady();
  await seed.useAccountRegistryStore.getState().recordSignIn({ key: "old", bytes: bytes(0), privyUserId: "did:privy:old", userId: "u-old", handle: "old", now: NOW });
  await settle();

  // The app has just started: the stored list is still being read when the
  // sign-in is recorded. The write must wait for it, not replace it.
  const fresh = openStore(storage);
  await fresh.useAccountRegistryStore.getState().recordSignIn({ key: "new", bytes: bytes(0), privyUserId: "did:privy:new", userId: "u-new", handle: "new", now: NOW + 1 });
  await settle();
  assert.deepEqual(fresh.useAccountRegistryStore.getState().accounts.map((a) => a.handle), ["old", "new"]);

  const reopened = openStore(storage);
  await reopened.registryReady();
  assert.deepEqual(reopened.useAccountRegistryStore.getState().accounts.map((a) => a.handle), ["old", "new"]);
});

test("the registry is not cleared when the signed-in account changes", () => {
  const source = fs.readFileSync(path.join(__dirname, "../stores/useAccountRegistryStore.ts"), "utf8");
  assert.doesNotMatch(source, /onAccountReset\(/);
});

// -------------------------------------------- what deletion leaves behind

test("an unreadable balance is never treated as an empty one", () => {
  assert.deepEqual(deletion.describeFunds([{ symbol: "USDC", balance: "0" }, { symbol: "ETH", balance: "0.0" }]), { status: "empty" });
  assert.deepEqual(deletion.describeFunds([{ symbol: "USDC", balance: "12.5" }, { symbol: "ETH", balance: "0" }]),
    { status: "funds", summary: "12.5 USDC" });
  assert.deepEqual(deletion.describeFunds([{ symbol: "USDC", balance: "0" }], "Balance unavailable"), { status: "unknown" });
  assert.deepEqual(deletion.describeFunds([]), { status: "unknown" });
  assert.deepEqual(deletion.describeFunds([{ symbol: "USDC", balance: "0" }], null, true), { status: "unknown" });
  assert.deepEqual(deletion.describeFunds([{ symbol: "USDC", balance: "abc" }]), { status: "unknown" });
});

// ------------------------------------------------- what the account screens do

const actions = load("services/accountActions.ts");
const display = load("utils/accountDisplay.ts");

const account = (over = {}) => ({
  key: "k1",
  privyUserId: "did:privy:1",
  userId: "u1",
  handle: "tanguy41",
  smartAccountAddress: "0x1234567890abcdef1234567890abcdef12345678",
  label: "Tanguy — Tests",
  labelSource: "user",
  authProvider: "passkey",
  passkeys: [],
  createdAt: NOW,
  lastUsedAt: NOW,
  profileDeletedAt: null,
  ...over,
});

test("removing the signed-in account from this phone signs it out first, then forgets it and its nicknames", async () => {
  const steps = [];
  await actions.removeAccountFromDevice({
    account: account(),
    isActive: true,
    logout: async () => steps.push("logout"),
    forgetRegistryEntry: async (key) => steps.push(`entry:${key}`),
    forgetNicknames: (userId) => steps.push(`nicknames:${userId}`),
  });
  assert.deepEqual(steps, ["logout", "entry:k1", "nicknames:u1"]);
});

test("removing another account does not sign the current one out", async () => {
  const steps = [];
  await actions.removeAccountFromDevice({
    account: account({ key: "k2", userId: null }),
    isActive: false,
    logout: async () => steps.push("logout"),
    forgetRegistryEntry: async (key) => steps.push(`entry:${key}`),
    forgetNicknames: (userId) => steps.push(`nicknames:${userId}`),
  });
  // An account that never finished setup has no nicknames to forget.
  assert.deepEqual(steps, ["entry:k2"]);
});

test("if signing out fails, nothing is forgotten", async () => {
  const steps = [];
  await assert.rejects(
    actions.removeAccountFromDevice({
      account: account(),
      isActive: true,
      logout: async () => {
        throw new Error("could not sign out");
      },
      forgetRegistryEntry: async () => steps.push("entry"),
      forgetNicknames: () => steps.push("nicknames"),
    }),
    /could not sign out/,
  );
  assert.deepEqual(steps, []);
});

test("removing an account from the phone does not touch the wallet, the passkey or the unfinished payments", () => {
  const source = fs.readFileSync(path.join(__dirname, "../services/accountActions.ts"), "utf8");
  const body = source.slice(source.indexOf("export const removeAccountFromDevice"), source.indexOf("export const buildSwitchTarget"));
  for (const forbidden of ["unlink", "deleteAccount", "AsyncStorage", "settlement", "pending-call-bundle", "SecureStore"]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
});

test("switching remembers the target, then signs out; a failed sign-out leaves no stale target", async () => {
  const seen = [];
  const target = actions.buildSwitchTarget(
    account({ passkeys: [{ credentialId: "cred-a", name: "Tanguy — Tests", createdAt: NOW, verifiedAt: NOW, origin: "atara" }] }),
    [],
  );
  assert.deepEqual(target.plan, { method: "passkey", credentialId: "cred-a" });
  await actions.switchToAccount({
    target,
    begin: (intent) => seen.push(["begin", intent.kind]),
    clear: () => seen.push(["clear"]),
    logout: async () => seen.push(["logout"]),
  });
  assert.deepEqual(seen, [["begin", "switch"], ["logout"]]);

  const failed = [];
  await assert.rejects(
    actions.switchToAccount({
      target,
      begin: () => failed.push("begin"),
      clear: () => failed.push("clear"),
      logout: async () => {
        throw new Error("provider unavailable");
      },
    }),
    /provider unavailable/,
  );
  assert.deepEqual(failed, ["begin", "clear"]);

  const adding = [];
  await assert.rejects(
    actions.startAddingAccount({
      begin: () => adding.push("begin"),
      clear: () => adding.push("clear"),
      logout: async () => {
        throw new Error("offline");
      },
    }),
    /offline/,
  );
  assert.deepEqual(adding, ["begin", "clear"]);
});

test("two accounts with the same private name are told apart in the switch confirmation", () => {
  const first = account({ key: "a", handle: "alice", label: "Perso" });
  const second = account({ key: "b", handle: "bob", label: "perso" });
  assert.equal(actions.buildSwitchTarget(first, [first, second]).label, "Perso · @alice");
  assert.equal(actions.buildSwitchTarget(second, [first, second]).label, "perso · @bob");
});

// A passkey is unlinked only when another way in is known to work.
const userWith = (linked) => ({ linked_accounts: linked });
const linkedPasskey = (id, extra = {}) => ({ type: "passkey", credential_id: id, ...extra });

test("a passkey is never unlinked when it is the last way in, and Privy is not even contacted", async () => {
  let unlinked = false;
  const outcome = await actions.removePasskeyFromAccount({
    user: userWith([linkedPasskey("cred-a"), { type: "wallet" }]),
    credentialId: "cred-a",
    verifiedCredentialIds: ["cred-a"],
    unlink: async () => {
      unlinked = true;
    },
    refreshUser: async () => ({ user: userWith([]) }),
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(outcome.assessment.reason, "last-method");
  assert.equal(unlinked, false);
});

test("a second passkey that was never tried on this phone does not count as a way in", async () => {
  let unlinked = false;
  const outcome = await actions.removePasskeyFromAccount({
    user: userWith([linkedPasskey("cred-a"), linkedPasskey("cred-b")]),
    credentialId: "cred-a",
    verifiedCredentialIds: ["cred-a"],
    unlink: async () => {
      unlinked = true;
    },
    refreshUser: async () => ({ user: userWith([]) }),
  });
  assert.equal(outcome.reason, "refused");
  assert.equal(outcome.assessment.reason, "untested-alternative");
  assert.equal(unlinked, false);
});

test("a passkey is unlinked with Privy's own spelling of its id, and only reported removed once Privy confirms", async () => {
  const calls = [];
  const rawId = "AbC+dE/fG==";
  const outcome = await actions.removePasskeyFromAccount({
    user: userWith([linkedPasskey(rawId, { enrolled_in_mfa: true }), { type: "google_oauth" }]),
    credentialId: options.normalizeCredentialId(rawId),
    verifiedCredentialIds: [],
    unlink: async (input) => {
      calls.push(input);
    },
    refreshUser: async () => ({ user: userWith([{ type: "google_oauth" }]) }),
  });
  assert.deepEqual(outcome, { ok: true });
  assert.deepEqual(calls, [{ credentialId: rawId, removeAsMfa: true }]);
});

test("if Privy still lists the passkey afterwards, it is not reported as removed", async () => {
  const still = userWith([linkedPasskey("cred-a"), { type: "apple_oauth" }]);
  const outcome = await actions.removePasskeyFromAccount({
    user: still,
    credentialId: "cred-a",
    verifiedCredentialIds: [],
    unlink: async () => {},
    refreshUser: async () => ({ user: still }),
  });
  assert.deepEqual(outcome, { ok: false, reason: "not-confirmed" });
});

test("a refused unlink (for example a second factor that was not given) says so and changes nothing", async () => {
  const outcome = await actions.removePasskeyFromAccount({
    user: userWith([linkedPasskey("cred-a"), { type: "google_oauth" }]),
    credentialId: "cred-a",
    verifiedCredentialIds: [],
    unlink: async () => {
      throw new Error("MFA verification required");
    },
    refreshUser: async () => ({ user: userWith([]) }),
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "failed");
  assert.match(outcome.message, /MFA verification required/);
});

test("after a switch, landing on the wrong account is decided by the Privy user id, not by a name", () => {
  const wanted = account({ key: "wanted", privyUserId: "did:privy:wanted", label: "Perso" });
  const other = account({ key: "other", privyUserId: "did:privy:other", userId: "u2", label: "Perso" });
  const state = { version: 1, accounts: [wanted, other] };
  const intent = { kind: "switch", target: { accountKey: "wanted" } };

  assert.equal(actions.checkLanding(state, intent, { privyUserId: "did:privy:wanted" }).matched, true);
  const wrong = actions.checkLanding(state, intent, { privyUserId: "did:privy:other" });
  assert.equal(wrong.matched, false);
  assert.equal(wrong.landed.key, "other");
  assert.equal(wrong.expected.key, "wanted");
  // Nothing to compare against outside a switch.
  assert.equal(actions.checkLanding(state, null, { privyUserId: "did:privy:other" }).matched, true);
  assert.equal(actions.checkLanding(state, { kind: "add" }, { privyUserId: "did:privy:other" }).matched, true);
});

test("the words shown for an account: handle, unfinished setup, deleted profile, and where the passkey is in iOS", () => {
  assert.equal(display.accountHeadline(account()), "@tanguy41");
  assert.equal(display.accountHeadline(account({ handle: null, userId: null })), "Setup not finished");
  assert.equal(display.accountHeadline(account({ handle: null, userId: null, profileDeletedAt: NOW })), "ATARA profile deleted");

  const named = { credentialId: "a", name: "Tanguy — Tests", createdAt: NOW, verifiedAt: NOW, origin: "atara" };
  const legacy = { credentialId: "b", name: null, createdAt: NOW, verifiedAt: null, origin: "existing" };
  assert.deepEqual(display.accountAccessLines(account({ passkeys: [named] })), ["iOS passkey: “Tanguy — Tests”"]);
  const lines = display.accountAccessLines(account({ passkeys: [named, legacy, { ...legacy, credentialId: "c" }], authProvider: "google" }));
  assert.equal(lines[0], "iOS passkey: “Tanguy — Tests”");
  // A passkey made before names existed is described as probably "ATARA", never as certainly.
  assert.match(lines[1], /2 passkeys created before names existed\. iOS probably lists them as “ATARA”\./);
  assert.equal(lines[2], "Created with Google");

  assert.match(display.describeSwitchMethod({ method: "passkey", credentialId: "a" }), /passkey.*Face ID/);
  assert.equal(display.describeSwitchMethod({ method: "oauth", provider: "apple" }), "Apple");
});

test("deleting the ATARA profile keeps the entry, its wallet address and its passkeys", () => {
  const passkey = { credentialId: "cred-a", name: "Tanguy — Tests", createdAt: NOW, verifiedAt: NOW, origin: "atara" };
  const before = { version: 1, accounts: [account({ labelSource: "auto", label: "@tanguy41", passkeys: [passkey] })] };
  const after = registry.markProfileDeleted(before, "k1", NOW + 1);
  const entry = after.accounts[0];
  assert.equal(entry.userId, null);
  assert.equal(entry.handle, null);
  assert.equal(entry.profileDeletedAt, NOW + 1);
  assert.equal(entry.smartAccountAddress, before.accounts[0].smartAccountAddress);
  assert.deepEqual(entry.passkeys, [passkey]);
  // The name no longer follows a handle that has been released.
  assert.equal(entry.labelSource, "user");
  assert.equal(entry.label, "@tanguy41");

  // A new profile for the same wallet clears the mark and is found by the Privy user id.
  const again = registry.recordSignIn(after, {
    key: "unused",
    bytes: bytes(1, 2, 3, 4),
    privyUserId: "did:privy:1",
    userId: "u-new",
    handle: "tanguy42",
    now: NOW + 2,
  });
  assert.equal(again.accounts.length, 1);
  assert.equal(again.accounts[0].userId, "u-new");
  assert.equal(again.accounts[0].profileDeletedAt, null);
  assert.equal(again.accounts[0].label, "@tanguy41");
  // And it survives a restart.
  assert.equal(registry.sanitizeRegistry(JSON.parse(JSON.stringify(after))).accounts[0].profileDeletedAt, NOW + 1);
});

test("small helpers: local keys, passkey names, and Privy's own credential spelling", () => {
  assert.equal(registry.newAccountKey(bytes(0, 15, 255)), "acct_000fff");
  assert.equal(registry.newAccountKey(bytes(1, 2, 3, 4)), registry.newAccountKey(bytes(1, 2, 3, 4)));
  assert.notEqual(registry.newAccountKey(bytes(1, 2, 3, 4)), registry.newAccountKey(bytes(1, 2, 3, 5)));

  assert.equal(labels.suggestPasskeyName("Tanguy — Tests", []), "Tanguy — Tests · 2");
  assert.equal(labels.suggestPasskeyName("Tanguy — Tests", ["tanguy — tests · 2"]), "Tanguy — Tests · 3");

  const user = { linked_accounts: [{ type: "passkey", credential_id: "AbC+dE/fG==" }, { type: "google_oauth" }] };
  assert.equal(methods.rawCredentialId(user, "AbC-dE_fG"), "AbC+dE/fG==");
  assert.equal(methods.rawCredentialId(user, "other"), undefined);
});

test("balances that were never read are not an empty wallet", () => {
  const placeholders = [{ symbol: "ETH", balance: "0" }];
  assert.equal(deletion.describeFunds(placeholders, null, false, null).status, "unknown");
  assert.equal(deletion.describeFunds(placeholders, null, false, "chain").status, "empty");
  assert.equal(deletion.describeFunds([{ symbol: "USDC", balance: "12.5" }], null, false, "service").status, "funds");
});

// ------------------------------------------- what the screens are wired to do

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("the passkey is named before it exists: the gate asks for a name, then creates", () => {
  const gate = read("components/onboarding/GateScreen.tsx");
  assert.doesNotMatch(gate, /onStartPasskey\("signup"\)/, "no unnamed signup from the gate");
  assert.match(gate, /onStartPasskey\("signup", \{ label \}\)/);
  assert.match(gate, /Name this account/);
  // What the person is told: private, on this iPhone, never sent to ATARA.
  assert.match(gate, /ATARA never receives it/);
  const provider = read("providers/AuthProvider.tsx");
  assert.doesNotMatch(provider, /useSignupWithPasskey/, "the SDK hook cannot pass a name to iOS");
  assert.match(provider, /createNamedPasskey\(passkeyDeps/);
});

test("the private name and the account list never go to the ATARA API", () => {
  for (const file of [
    "stores/useAccountRegistryStore.ts",
    "stores/useAccountSwitchStore.ts",
    "utils/accountRegistry.ts",
    "utils/accountLabels.ts",
    "utils/accountDisplay.ts",
    "services/accountActions.ts",
    "services/passkey.service.ts",
    "hooks/usePasskeyManagement.ts",
    "app/manage-accounts.tsx",
    "app/sign-in-methods.tsx",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /services\/api|["']axios["']|\bfetch\(|AuthService|UserService/, file);
  }
  // Registration sends the public identity only.
  const provider = read("providers/AuthProvider.tsx");
  const call = provider.slice(provider.indexOf("await AuthService.register({"), provider.indexOf("}, signal);", provider.indexOf("await AuthService.register({")));
  assert.doesNotMatch(call, /label|passkeyName/i);
  // No backend route hands out accounts known on a phone.
  assert.equal(fs.existsSync(path.join(__dirname, "../../backend/routes/account.routes.ts")), false);
});

test("the list of accounts is kept on the phone, and the sign-in screen shows only the account just chosen", () => {
  assert.doesNotMatch(read("stores/useAccountSwitchStore.ts"), /persist\(|AsyncStorage|SecureStore/);
  assert.match(read("stores/useAccountRegistryStore.ts"), /createJSONStorage\(\(\) => AsyncStorage\)/);
  const gate = read("components/onboarding/GateScreen.tsx");
  assert.doesNotMatch(gate, /useAccountRegistryStore/, "the gate must not read the list of accounts");
  assert.match(read("app/onboarding.tsx"), /useAccountRegistryStore/);
  // ...only for names already used, never to list accounts.
  assert.doesNotMatch(read("app/onboarding.tsx"), /accounts\.map|\.handle/);
});

test("Manage accounts offers each action, and each removal is a separate, explained one", () => {
  const screen = read("app/manage-accounts.tsx");
  for (const label of ["Rename", "Switch", "Remove from this iPhone", "Add another account", "Delete ATARA account", "Passkeys & sign-in"]) {
    assert.ok(screen.includes(label), label);
  }
  assert.match(screen, /removeAccountFromDevice/);
  assert.match(screen, /switchToAccount/);
  assert.match(screen, /startAddingAccount/);
  assert.match(screen, /<DeleteAccountModal/);
  // A local rename must not be presented as renaming iOS's own list.
  assert.match(screen, /does not rename the passkey in iOS/);

  const signIn = read("app/sign-in-methods.tsx");
  assert.match(signIn, /Settings › Passwords/);
  assert.match(signIn, /cannot rename or delete what iOS stores/);
  assert.match(signIn, /assessPasskeyRemoval/);
  // Before removing, the person is told what they will still be able to sign in with.
  assert.match(signIn, /You will still be able to sign in with/);

  const remove = read("components/profile/DeleteAccountModal.tsx");
  assert.match(remove, /typedConfirmation="DELETE"/);
  assert.match(remove, /Your money/);
  assert.match(remove, /passkeys and your wallet/);
});

test("Profile and Security lead to the account screens; the old unnamed passkey button is gone", () => {
  const profile = read("app/(tabs)/profile.tsx");
  assert.match(profile, /label="Manage accounts"/);
  assert.match(profile, /router\.push\("\/manage-accounts"/);
  assert.match(profile, /<DeleteAccountModal/);
  assert.doesNotMatch(profile, /UserService/, "deletion lives in one place");
  const security = read("app/security.tsx");
  assert.doesNotMatch(security, /useLinkWithPasskey/);
  assert.match(security, /router\.push\("\/sign-in-methods"/);
  const layout = read("app/_layout.tsx");
  for (const route of ["manage-accounts", "sign-in-methods"]) {
    assert.match(layout, new RegExp(`"${route}",`), `${route} is a protected route`);
    assert.match(layout, new RegExp(`<Stack.Screen name="${route}"`), `${route} is a screen`);
  }
});

test("the public name and the private name are never confused in the copy", () => {
  assert.match(read("components/onboarding/IdentityScreen.tsx"), /This is your public name/);
  assert.match(read("components/profile/DisplayNameModal.tsx"), /This is your public name/);
  assert.doesNotMatch(read("components/profile/DisplayNameModal.tsx"), /may still show “ATARA”/);
});

test("switching account empties the balances, contacts and nicknames of the one left, and pending payments stay with theirs", () => {
  const auth = read("stores/useAuthStore.ts");
  const logout = auth.slice(auth.indexOf("logout: async () =>"), auth.indexOf("loadSession: async"));
  assert.match(logout, /useWalletStore\.getState\(\)\.reset\(\)/);
  assert.match(logout, /resetAccountScope\(\)/);
  assert.match(auth, /if \(get\(\)\.user\?\.id !== user\.id\) resetAccountScope\(\)/);
  assert.match(auth, /useAddressBookStore\.getState\(\)\.openFor\(user\.id\)/);
  // Unfinished payments are kept per user and per wallet address, never wiped by a switch.
  assert.match(read("services/settlementRecovery.service.ts"), /const prefix = /);
  assert.doesNotMatch(logout, /AsyncStorage|pending/i);
});

test("a name that iOS already shows for every older passkey is refused, because it would bring the confusion back", () => {
  for (const same of ["ATARA", "atara", " Atara "]) {
    const result = labels.checkAccountLabel(same, []);
    assert.equal(result.ok, false, same);
    assert.equal(result.reason, "reserved", same);
  }
  assert.equal(labels.checkAccountLabel("ATARA Perso", []).ok, true);
  assert.equal(registry.renameAccount({ version: 1, accounts: [account()] }, "k1", "Atara").result.reason, "reserved");
  assert.notEqual(labels.suggestAccountLabel({ taken: [], bytes: bytes(0, 0, 0, 0) }).toLowerCase(), "atara");
});

test("two entries for one person, made before the Privy user was known, become one when both ids are known", () => {
  const passkey = (id, extra = {}) => ({ credentialId: id, name: null, createdAt: NOW, verifiedAt: null, origin: "existing", ...extra });
  const madeFromSessionOnly = account({
    key: "from-session",
    privyUserId: null,
    label: "Tanguy — Perso",
    labelSource: "user",
    passkeys: [passkey("cred-a", { name: "Tanguy — Perso", verifiedAt: NOW, origin: "atara" })],
  });
  const madeFromPasskey = account({
    key: "from-passkey",
    privyUserId: "did:privy:1",
    userId: null,
    label: "Account 7KQ2",
    labelSource: "auto",
    handle: null,
    passkeys: [passkey("cred-a"), passkey("cred-b")],
  });
  const other = account({ key: "someone-else", privyUserId: "did:privy:2", userId: "u2", handle: "bob", label: "Bob" });
  const after = registry.recordSignIn(
    { version: 1, accounts: [madeFromSessionOnly, madeFromPasskey, other] },
    { key: "unused", bytes: bytes(1, 2, 3, 4), privyUserId: "did:privy:1", userId: "u1", handle: "tanguy41", now: NOW + 5 },
  );
  assert.deepEqual(after.accounts.map((entry) => entry.key).sort(), ["from-passkey", "someone-else"]);
  const merged = after.accounts.find((entry) => entry.key === "from-passkey");
  // The name the person chose survives; the Privy id and the ATARA id are both set.
  assert.equal(merged.label, "Tanguy — Perso");
  assert.equal(merged.labelSource, "user");
  assert.equal(merged.privyUserId, "did:privy:1");
  assert.equal(merged.userId, "u1");
  // Passkeys are united, keeping what either copy knew.
  assert.deepEqual(merged.passkeys.map((p) => p.credentialId).sort(), ["cred-a", "cred-b"]);
  const cred = merged.passkeys.find((p) => p.credentialId === "cred-a");
  assert.equal(cred.name, "Tanguy — Perso");
  assert.equal(cred.verifiedAt, NOW);
  // Another person's entry is never touched.
  assert.equal(after.accounts.find((entry) => entry.key === "someone-else").label, "Bob");
});
