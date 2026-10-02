const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createLoader } = require("./lib/loadTs.cjs");

const { AUTH_ROUTES, PROTECTED_ROUTES, decideRedirect } = createLoader()("utils/routeGuard.ts");
const appDir = path.join(__dirname, "..", "app");

/** Every top-level route expo-router builds from the files in app/. */
const routesOnDisk = () =>
  fs
    .readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("_") && !entry.name.startsWith("+"))
    .filter((entry) => entry.isDirectory() || /\.(tsx|ts)$/.test(entry.name))
    .map((entry) => entry.name.replace(/\.(tsx|ts)$/, ""));

test("every screen in app/ is a known route, so none opens as a black screen and bounces back", () => {
  const known = new Set([...AUTH_ROUTES, ...PROTECTED_ROUTES]);
  const missing = routesOnDisk().filter((route) => !known.has(route));
  assert.deepEqual(missing, [], `Add these to PROTECTED_ROUTES in utils/routeGuard.ts: ${missing.join(", ")}`);
});

test("no route is listed that does not exist", () => {
  const onDisk = new Set(routesOnDisk());
  const stale = [...AUTH_ROUTES, ...PROTECTED_ROUTES].filter((route) => !onDisk.has(route));
  assert.deepEqual(stale, []);
});

test("Plans & Miles and ATARA Card are reachable while signed in, and the others still are", () => {
  for (const route of ["plans", "card", "manage-accounts", "pay-merchant", "add-crypto", "(tabs)", "send"]) {
    assert.equal(decideRedirect({ route, isReady: true, isFullyAuthenticated: true }), null, route);
  }
});

test("the redirect rules are unchanged: signed out goes to onboarding, signed in leaves it, unknown routes go home", () => {
  assert.equal(decideRedirect({ route: "plans", isReady: true, isFullyAuthenticated: false }), "onboarding");
  assert.equal(decideRedirect({ route: "onboarding", isReady: true, isFullyAuthenticated: false }), null);
  assert.equal(decideRedirect({ route: "onboarding", isReady: true, isFullyAuthenticated: true }), "tabs");
  assert.equal(decideRedirect({ route: "oauth-callback", isReady: true, isFullyAuthenticated: true }), "tabs");
  assert.equal(decideRedirect({ route: "does-not-exist", isReady: true, isFullyAuthenticated: true }), "tabs");
  assert.equal(decideRedirect({ route: "plans", isReady: false, isFullyAuthenticated: true }), null);
});

test("the layout uses the guard and registers both screens", () => {
  const layout = fs.readFileSync(path.join(appDir, "_layout.tsx"), "utf8");
  assert.match(layout, /decideRedirect\(\{ route, isReady, isFullyAuthenticated \}\)/);
  assert.doesNotMatch(layout, /const PROTECTED_ROUTES/);
  assert.match(layout, /<Stack\.Screen name="plans"/);
  assert.match(layout, /<Stack\.Screen name="card"/);
});

test("Home and Profile navigate to routes that exist", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const onDisk = new Set(routesOnDisk());
  const target = (source, pattern) => {
    const match = source.match(pattern);
    assert.ok(match, `no navigation matching ${pattern}`);
    return match[1];
  };
  assert.ok(onDisk.has(target(read("app/(tabs)/profile.tsx"), /router\.push\("\/(plans)" as never\)/)));
  assert.ok(onDisk.has(target(read("app/(tabs)/index.tsx"), /router\.push\("\/(card)" as never\)/)));
});
