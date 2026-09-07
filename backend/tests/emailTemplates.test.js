const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");
const {
  escapeHtml,
  feedbackEmailHtml,
} = require("../utils/emailTemplates.ts");

const HOSTILE_HANDLE = '<img src=x onerror=alert(1)>';

test("escapes a hostile handle instead of emitting it as markup", () => {
  const html = feedbackEmailHtml("fb-1", HOSTILE_HANDLE, "hello", new Date(0));

  // The handle reaches this template from the database, where PATCH /user/me
  // used to let a user write anything. Unescaped, it executed in the inbox of
  // whoever read the feedback mail.
  // Escaping neutralises the markup; the attribute text survives as inert
  // characters inside the escaped string, which is fine - what matters is that
  // no tag is ever emitted.
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes(HOSTILE_HANDLE), false);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

test("still escapes a hostile message", () => {
  const html = feedbackEmailHtml(
    "fb-2",
    "alice",
    "<script>alert(1)</script>",
    new Date(0),
  );

  assert.equal(html.includes("<script>"), false);
  assert.ok(html.includes("&lt;script&gt;"));
});

test("turns newlines into markup only after escaping", () => {
  const html = feedbackEmailHtml(
    "fb-3",
    "alice",
    "line one\n<b>line two</b>",
    new Date(0),
  );

  assert.ok(html.includes("line one<br/>&lt;b&gt;line two&lt;/b&gt;"));
});

test("escapes the feedback id", () => {
  const html = feedbackEmailHtml("<i>id</i>", "alice", "hello", new Date(0));

  assert.equal(html.includes("<i>id</i>"), false);
  assert.ok(html.includes("&lt;i&gt;id&lt;/i&gt;"));
});

test("escapeHtml covers ampersand, angle brackets and quotes", () => {
  assert.equal(escapeHtml('&<>"'), "&amp;&lt;&gt;&quot;");
});

test("an absent handle still renders as anonymous", () => {
  const html = feedbackEmailHtml("fb-4", undefined, "hello", new Date(0));

  assert.ok(html.includes("anonymous"));
});
