const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");
const {
  normalizeDisplayName,
  normalizeEmail,
  normalizeHandle,
  normalizeProfilePicUrl,
} = require("../utils/profileValidation.ts");

const rejects = (fn, value) =>
  assert.throws(() => fn(value), (error) => error.statusCode === 400);

test("canonicalizes a handle to lowercase and trims it", () => {
  // Registration stored lowercase and getUserByHandle looks up lowercase, but
  // PATCH /user/me stored the value verbatim - so "Alice" became unreachable.
  assert.equal(normalizeHandle("Alice"), "alice");
  assert.equal(normalizeHandle("  Bob_1 "), "bob_1");
});

test("refuses handles that registration would have refused", () => {
  rejects(normalizeHandle, "ab");
  rejects(normalizeHandle, "a".repeat(21));
  rejects(normalizeHandle, "a-b");
  rejects(normalizeHandle, "a b");
  rejects(normalizeHandle, "a@b");
  rejects(normalizeHandle, "<img src=x>");
  rejects(normalizeHandle, 42);
});

test("accepts only absolute https profile picture URLs", () => {
  assert.equal(
    normalizeProfilePicUrl("https://cdn.example.com/a.png"),
    "https://cdn.example.com/a.png",
  );

  rejects(normalizeProfilePicUrl, "javascript:alert(1)");
  rejects(normalizeProfilePicUrl, "data:text/html,<script>alert(1)</script>");
  rejects(normalizeProfilePicUrl, "http://cdn.example.com/a.png");
  rejects(normalizeProfilePicUrl, "not a url");
  rejects(normalizeProfilePicUrl, `https://x/${"a".repeat(2100)}`);
});

test("validates email shape and length", () => {
  assert.equal(normalizeEmail("  Demo@Example.COM "), "demo@example.com");

  rejects(normalizeEmail, "demo.example.com");
  rejects(normalizeEmail, "demo@example");
  rejects(normalizeEmail, "demo @example.com");
  rejects(normalizeEmail, `${"a".repeat(250)}@example.com`);
});

test("validates display name", () => {
  assert.equal(normalizeDisplayName("  Alice Smith "), "Alice Smith");

  rejects(normalizeDisplayName, "   ");
  rejects(normalizeDisplayName, "a".repeat(51));
  rejects(normalizeDisplayName, "alice\u0000smith");
  rejects(normalizeDisplayName, "alice\u007Fsmith");
});
