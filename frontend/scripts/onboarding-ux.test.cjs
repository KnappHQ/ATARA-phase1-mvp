const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const load = createLoader();
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

// ---- A: @handle rules ------------------------------------------------------

const rules = load("utils/handleRules.ts");

test("sanitizeHandle lowercases, strips other characters and refuses the 21st", () => {
  assert.equal(rules.sanitizeHandle("Ab-c_1!"), "abc_1");
  assert.equal(rules.sanitizeHandle("a".repeat(25)), "a".repeat(20));
  assert.equal(rules.sanitizeHandle("a".repeat(20) + "b").length, 20);
});

test("strippedCharacters flags removed characters but not letter case", () => {
  assert.equal(rules.strippedCharacters("Tanguy-1"), true);
  assert.equal(rules.strippedCharacters("Tanguy"), false);
  assert.equal(rules.strippedCharacters("tanguy_1"), false);
});

test("handleStatus covers short, checking, available, taken and error", () => {
  const base = { handle: "", isChecking: false, isAvailable: null, error: null };
  const status = (patch) => rules.handleStatus({ ...base, ...patch });

  assert.deepEqual(status({ handle: "" }), { kind: "too_short", message: "Add 3 more characters" });
  assert.deepEqual(status({ handle: "ab" }), { kind: "too_short", message: "Add 1 more character" });
  assert.equal(status({ handle: "abc", isChecking: true }).kind, "checking");
  assert.deepEqual(status({ handle: "abc", isAvailable: true }), { kind: "available", message: "@abc is available" });
  assert.deepEqual(status({ handle: "abc", isAvailable: false }), { kind: "taken", message: "@abc is taken. Try another." });
  assert.equal(status({ handle: "a".repeat(20), isAvailable: true }).kind, "available");
  assert.equal(status({ handle: "abc", error: "No connection" }).message, "No connection");
  assert.equal(status({ handle: "abc" }), null);
});

test("client handle rules match backend/utils/profileValidation.ts", () => {
  const backend = fs.readFileSync(path.join(__dirname, "..", "..", "backend", "utils", "profileValidation.ts"), "utf8");
  assert.equal(Number(/HANDLE_MIN_LENGTH = (\d+)/.exec(backend)[1]), rules.HANDLE_MIN);
  assert.equal(Number(/HANDLE_MAX_LENGTH = (\d+)/.exec(backend)[1]), rules.HANDLE_MAX);
  assert.match(backend, /HANDLE_PATTERN = \/\^\[a-z0-9_\]\+\$\//);
});

test("identity screen shows the rules, a counter and that the @handle is fixed", () => {
  const screen = read("components/onboarding/IdentityScreen.tsx");
  assert.match(screen, /HANDLE_RULES_TEXT/);
  assert.match(screen, /handle\.length\}\/\{HANDLE_MAX\}/);
  assert.match(screen, /HANDLE_FIXED_TEXT/);
  assert.equal(rules.HANDLE_RULES_TEXT, "3 to 20 characters. Lowercase letters, numbers and _ only.");
  assert.match(rules.HANDLE_FIXED_TEXT, /can't change your @handle in the app yet/);
});
