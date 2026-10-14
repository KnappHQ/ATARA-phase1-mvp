const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.NODE_ENV = "test";
require("ts-node/register");

const express = require("express");
const request = require("supertest");
const { canonicalizeIp, isPublicIp, ipFamily, resolveClientIp, clientIpSource, describeIpSources } = require("../utils/clientIp.ts");

const API = "pk_test_AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const SECRET = "sk_test_ZyXwVuTsRqPoNmLkJiHgFeDcBa987654";
const WALLET = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae";
const IPV4 = "81.2.69.160";
const IPV6 = "2a02:26f0:1:2::3";

/** The service reads its configuration at import time, so each scenario gets a fresh copy. */
const freshService = (env = { MOONPAY_API_KEY: API, MOONPAY_SECRET_KEY: SECRET }) => {
  const saved = { ...process.env };
  for (const key of ["MOONPAY_API_KEY", "MOONPAY_SECRET_KEY", "MOONPAY_WIDGET_URL", "MOONPAY_CURRENCY_CODE", "MOONPAY_BASE_CURRENCY_CODE", "ONRAMP_REDIRECT_URL", "ALCHEMY_NETWORK"]) delete process.env[key];
  Object.assign(process.env, env);
  for (const name of Object.keys(require.cache)) {
    if (/\/(utils\/constants|services\/onramp\.service)\.ts$/.test(name)) delete require.cache[name];
  }
  try {
    return require("../services/onramp.service.ts");
  } finally {
    process.env = saved;
  }
};
const hmac = (ip) => crypto.createHmac("sha256", SECRET).update(ip).digest("base64");
const quiet = (run) => {
  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = (chunk) => { captured += String(chunk); return true; };
  try { return { result: run(), captured: () => captured }; } finally { process.stderr.write = original; }
};

// ---------------------------------------------------------------- canonical form

test("IPs are written exactly as MoonPay compares them", () => {
  const cases = [
    ["203.0.113.42", "203.0.113.42"],
    [" 81.2.69.160 ", "81.2.69.160"],
    ["81.2.69.160:443", "81.2.69.160"],
    ["2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1"],
    ["[2001:db8::1]:443", "2001:db8::1"],
    ["[2A02:26F0:0001:0002:0000:0000:0000:0003]", "2a02:26f0:1:2::3"],
    ["::ffff:203.0.113.42", "203.0.113.42"],
    ["::FFFF:81.2.69.160", "81.2.69.160"],
    ["2001:db8:0:1:0:0:0:1", "2001:db8:0:1::1"],
    ["2001:db8:0:0:1:0:0:1", "2001:db8::1:0:0:1"],
  ];
  for (const [raw, expected] of cases) assert.equal(canonicalizeIp(raw), expected, raw);
});

test("anything that is not one clean IP is refused", () => {
  for (const raw of ["", "  ", "010.1.1.1", "1.2.3", "1.2.3.4.5", "256.1.1.1", "1.2.3.4, 5.6.7.8", "fe80::1%en0", "[2001:db8::1", "example.com", "0x7f.0.0.1", null, undefined, 42]) {
    assert.equal(canonicalizeIp(raw), null, String(raw));
  }
});

test("only a public address can be what MoonPay sees", () => {
  for (const ip of [IPV4, "8.8.8.8", IPV6]) assert.equal(isPublicIp(canonicalizeIp(ip)), true, ip);
  for (const ip of ["10.0.0.1", "172.16.5.4", "192.168.1.1", "127.0.0.1", "169.254.1.1", "100.64.0.1", "0.0.0.0", "240.0.0.1", "255.255.255.255", "224.0.0.1", "203.0.113.42", "::1", "::", "fe80::1", "fd00::1", "ff02::1", "2001:db8::1", "64:ff9b::1"]) {
    assert.equal(isPublicIp(canonicalizeIp(ip)), false, ip);
  }
  assert.equal(ipFamily("81.2.69.160"), "ipv4");
  assert.equal(ipFamily("2a02:26f0:1:2::3"), "ipv6");
});

// ---------------------------------------------------------------- where the IP comes from

test("by default the IP is Express's req.ip; client-set headers are ignored", () => {
  const req = { ip: IPV4, headers: { "true-client-ip": "8.8.8.8", "x-forwarded-for": "8.8.4.4" } };
  assert.deepEqual(resolveClientIp(req, "forwarded"), { ip: IPV4, family: "ipv4" });
  assert.equal(clientIpSource(undefined), "forwarded");
  assert.equal(clientIpSource("anything-else"), "forwarded");
  assert.equal(clientIpSource(" True-Client-IP "), "true-client-ip");
});

test("True-Client-IP is read only when configured, and a private value is refused", () => {
  assert.deepEqual(resolveClientIp({ ip: "10.0.0.2", headers: { "true-client-ip": IPV6 } }, "true-client-ip"), { ip: IPV6, family: "ipv6" });
  assert.equal(resolveClientIp({ ip: IPV4, headers: {} }, "true-client-ip"), null, "no header, no guess");
  assert.equal(resolveClientIp({ ip: "10.0.0.2", headers: {} }, "forwarded"), null);
});

test("with one trusted proxy, a client-forged X-Forwarded-For entry is not the IP", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.get("/ip", (req, res) => res.json({ used: resolveClientIp(req, "forwarded"), sources: describeIpSources(req) }));
  // The client sent "8.8.8.8"; the proxy (Render) appended the real address it saw.
  const res = await request(app).get("/ip").set("X-Forwarded-For", `8.8.8.8, ${IPV4}`).set("True-Client-IP", "8.8.4.4");
  assert.deepEqual(res.body.used, { ip: IPV4, family: "ipv4" });
  assert.equal(res.body.sources.forwardedForFirst, "8.8.8.8");
  assert.equal(res.body.sources.trueClientIp, "8.8.4.4");
  assert.equal(res.body.sources.forwardedForCount, 2);
});

// ---------------------------------------------------------------- allowedIpAddress

test("the hash is HMAC-SHA256 of the canonical IP with the secret key, base64", () => {
  const { hashMoonPayIp, buildAllowedIpAddress } = freshService();
  assert.equal(hashMoonPayIp(IPV4, SECRET), hmac(IPV4));
  assert.deepEqual(buildAllowedIpAddress([` ${IPV4}:443 `], SECRET), { value: hmac(IPV4), families: ["ipv4"] });
  assert.deepEqual(buildAllowedIpAddress(["2A02:26F0:0001:0002::3"], SECRET), { value: hmac(IPV6), families: ["ipv6"] });
});

test("two hashes at most, one per family, only for addresses actually given", () => {
  const { buildAllowedIpAddress } = freshService();
  assert.deepEqual(buildAllowedIpAddress([IPV6, IPV4], SECRET), { value: `${hmac(IPV4)},${hmac(IPV6)}`, families: ["ipv4", "ipv6"] });
  assert.deepEqual(buildAllowedIpAddress([IPV4, IPV4], SECRET).families, ["ipv4"], "the same address twice is one hash");
  assert.throws(() => buildAllowedIpAddress([IPV4, "8.8.8.8"], SECRET), (e) => e.code === "MP-IP-AMBIGUOUS");
  assert.throws(() => buildAllowedIpAddress(["192.168.1.2"], SECRET), (e) => e.code === "MP-IP-UNAVAILABLE");
  assert.throws(() => buildAllowedIpAddress([], SECRET), (e) => e.code === "MP-IP-UNAVAILABLE");
});

test("allowedIpAddress is inside the signed query, and the URL verifies", () => {
  const { buildMoonPayWidgetUrl, verifyMoonPayUrl } = freshService();
  const { result: url } = quiet(() => buildMoonPayWidgetUrl({ walletAddress: WALLET, baseCurrencyAmount: "50", clientIps: [IPV4, IPV6] }));
  const query = url.slice(url.indexOf("?"), url.lastIndexOf("&signature="));
  assert.match(query, /&allowedIpAddress=[^&]+$/, "added before the signature, after every other parameter");
  assert.equal(new URL(url).searchParams.get("allowedIpAddress"), `${hmac(IPV4)},${hmac(IPV6)}`);
  // Base64 characters and the comma are URL-encoded in the query that is signed.
  assert.doesNotMatch(query.split("allowedIpAddress=")[1], /[+/=,]/);
  assert.equal(verifyMoonPayUrl(url, SECRET), true);
  const expected = crypto.createHmac("sha256", SECRET).update(query).digest("base64");
  assert.equal(decodeURIComponent(url.slice(url.lastIndexOf("&signature=") + 11)), expected);
  // Swapping the hash for another IP's breaks the signature.
  const forged = url.replace(encodeURIComponent(hmac(IPV4)), encodeURIComponent(hmac("8.8.8.8")));
  assert.notEqual(forged, url);
  assert.equal(verifyMoonPayUrl(forged, SECRET), false);
});

test("a customer session is never created without an observed IP", () => {
  const { createMoonPaySession } = freshService();
  for (const clientIps of [undefined, []]) {
    assert.throws(() => createMoonPaySession({ walletAddress: WALLET, clientIps }), (e) => e.statusCode === 503 && e.code === "MP-IP-UNAVAILABLE");
  }
  const { result: session } = quiet(() => createMoonPaySession({ walletAddress: WALLET, clientIps: [IPV4] }));
  assert.equal(session.mode, "sandbox");
  assert.ok(new URL(session.url).searchParams.get("allowedIpAddress"));
});

test("the log says how many IP hashes and which families, never the IP, the hash, a key or the URL", () => {
  const { buildMoonPayWidgetUrl } = freshService();
  const { result: url, captured } = quiet(() => buildMoonPayWidgetUrl({ walletAddress: WALLET, clientIps: [IPV6] }));
  const text = captured();
  const line = JSON.parse(text.trim().split("\n").pop());
  assert.equal(line.ipHashes, 1);
  assert.deepEqual(line.ipFamilies, ["ipv6"]);
  for (const secret of [IPV6, hmac(IPV6), encodeURIComponent(hmac(IPV6)), SECRET.slice(8), API.slice(8), WALLET, url]) {
    assert.equal(text.includes(secret), false, "leaked into the log");
  }
});

test("the controller reads the IP from the request, not from the body", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "controllers", "onramp.controller.ts"), "utf8");
  assert.match(source, /resolveClientIp\(req, clientIpSource\(MOONPAY_CLIENT_IP_SOURCE\)\)/);
  assert.doesNotMatch(source, /req\.body\??\.(ip|clientIp|allowedIpAddress)/);
  const routes = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "routers", "wallet.routes.ts"), "utf8");
  assert.match(routes, /router\.post\("\/onramp-session", authentication, onrampController\.createSession\)/);
  assert.match(routes, /router\.get\("\/onramp-ip-check", authentication, onrampController\.ipCheck\)/);
});
