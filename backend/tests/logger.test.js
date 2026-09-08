const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

// utils/constants reads NODE_ENV at import time, so the environment has to be
// set before the logger is required.
const loadLogger = (nodeEnv) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  for (const key of Object.keys(require.cache)) {
    if (key.includes("/utils/logger.ts") || key.includes("/utils/constants.ts")) {
      delete require.cache[key];
    }
  }

  const logger = require("../utils/logger.ts");
  process.env.NODE_ENV = previous;
  return logger;
};

const capture = (fn) => {
  const written = [];
  const original = process.stderr.write;
  process.stderr.write = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  try {
    fn();
  } finally {
    process.stderr.write = original;
  }
  return written;
};

test("writes one JSON line carrying context and error", () => {
  const { logError } = loadLogger("development");

  const [line] = capture(() =>
    logError("unhandled_error", new TypeError("boom"), { method: "GET" }),
  );

  assert.ok(line.endsWith("\n"));
  const entry = JSON.parse(line);
  assert.equal(entry.level, "error");
  assert.equal(entry.context, "unhandled_error");
  assert.equal(entry.error, "TypeError");
  assert.equal(entry.message, "boom");
  assert.equal(entry.method, "GET");
  assert.ok(!Number.isNaN(Date.parse(entry.time)));
});

test("keeps the stack out of production logs", () => {
  const { logError } = loadLogger("production");

  const [line] = capture(() => logError("unhandled_error", new Error("boom")));

  const entry = JSON.parse(line);
  assert.equal("stack" in entry, false);
  // The event itself is still recorded - that is the whole point.
  assert.equal(entry.message, "boom");
});

test("includes the stack outside production", () => {
  const { logError } = loadLogger("development");

  const entry = JSON.parse(
    capture(() => logError("unhandled_error", new Error("boom")))[0],
  );

  assert.equal(typeof entry.stack, "string");
});

test("handles a thrown non-error", () => {
  const { logError } = loadLogger("production");

  const entry = JSON.parse(capture(() => logError("ctx", "just a string"))[0]);

  assert.equal(entry.error, "NonError");
  assert.equal(entry.message, "just a string");
});

test("redacts secrets carried in the request path", () => {
  const { redactPath } = loadLogger("production");

  const token = "a".repeat(64);
  assert.equal(
    redactPath(`/api/v1/requests/pay/${token}`),
    "/api/v1/requests/pay/[redacted]",
  );
  assert.equal(
    redactPath(`/api/v1/transaction/0x${"b".repeat(64)}`),
    "/api/v1/transaction/[redacted]",
  );
  // Ordinary paths are left alone.
  assert.equal(redactPath("/api/v1/user/search"), "/api/v1/user/search");
  assert.equal(redactPath("/api/v1/health/db"), "/api/v1/health/db");
});
