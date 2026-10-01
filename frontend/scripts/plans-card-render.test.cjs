const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/loadTs.cjs");

/**
 * Renders the two screens with the React and React Native boundaries replaced by
 * plain objects: a logic simulation (it draws nothing and is not an iPhone), good
 * enough to catch a screen that throws, renders nothing, or loses its content
 * when the service fails.
 */

let slots = [];
let cursor = 0;
const react = {
  useState: (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  },
};
const jsx = (type, props, key) => ({ type, props: { ...props, ...(key === undefined ? {} : { key }) } });
const host = (name) => name;
const pushes = [];
const alerts = [];
let hookState;
let waitlistResult = "ok";
let waitlistCalls = 0;

const mocks = {
  react,
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react-native": { Pressable: host("Pressable"), ScrollView: host("ScrollView"), Text: host("Text"), View: host("View"), ActivityIndicator: host("ActivityIndicator") },
  "react-native-safe-area-context": { SafeAreaView: host("SafeAreaView") },
  "expo-router": { useRouter: () => ({ back: () => pushes.push("back"), push: (to) => pushes.push(to) }) },
  "lucide-react-native": new Proxy({}, { get: (_, name) => host(String(name)) }),
  "@/components/activity/LoadNotice": { LoadNotice: host("LoadNotice") },
  "@/hooks/useEntitlements": { useEntitlements: () => hookState },
  "@/utils/constants": { COLORS: { white: "#fff", black: "#000", accent: "#dfccb1" } },
  "@/stores/useAlertStore": { useAlertStore: { getState: () => ({ success: (...a) => alerts.push(["success", ...a]), error: (...a) => alerts.push(["error", ...a]) }) } },
  "@/services/subscription.service": {
    SubscriptionService: {
      joinCardWaitlist: async () => {
        waitlistCalls++;
        if (waitlistResult === "404") throw Object.assign(new Error("x"), { response: { status: 404 } });
        if (waitlistResult === "offline") throw Object.assign(new Error("Network Error"), { code: "ERR_NETWORK", request: {} });
      },
    },
  },
};
const load = createLoader({ mocks });
const PlansScreen = load("app/plans.tsx").default;
const CardScreen = load("app/card.tsx").default;
const { LoadNotice } = createLoader({ mocks: { ...mocks, "@/components/activity/LoadNotice": undefined } })("components/activity/LoadNotice.tsx");
delete mocks["@/components/activity/LoadNotice"];

const walk = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node !== "object") return [node];
  const kids = node.props?.children;
  return [node, ...(kids === undefined ? [] : [kids].flat(Infinity).flatMap(walk))];
};
const elements = (tree) => walk(tree).filter((n) => n && typeof n === "object");
// A custom component (Badge) is not called by this mini runtime: what it draws from its `label` prop is read from the prop.
const textOf = (tree) =>
  walk(tree)
    .flatMap((p) =>
      typeof p === "string" || typeof p === "number" ? [p] : typeof p?.type === "function" && typeof p.props?.label === "string" ? [p.props.label] : [],
    )
    .join("|");
const render = (component) => { cursor = 0; return component({}); };
const fresh = () => { slots = []; cursor = 0; pushes.length = 0; alerts.length = 0; waitlistCalls = 0; waitlistResult = "ok"; };

const { buildPlansView } = load("utils/plansScreen.ts");
const withState = (partial) => {
  hookState = { plans: null, mine: null, card: null, plansLoad: { status: "ready" }, cardLoad: { status: "ready" }, refresh: () => pushes.push("refresh"), ...partial };
};
const SCENARIOS = {
  "unauthenticated": { plansLoad: { status: "unavailable", failure: "unauthorized" }, cardLoad: { status: "unavailable", failure: "unauthorized" } },
  "an older service (404)": { plansLoad: { status: "unavailable", failure: "not-found" }, cardLoad: { status: "unavailable", failure: "not-found" } },
  "a server error (500)": { plansLoad: { status: "unavailable", failure: "server" }, cardLoad: { status: "unavailable", failure: "server" } },
  "offline": { plansLoad: { status: "unavailable", failure: "offline" }, cardLoad: { status: "unavailable", failure: "offline" } },
  "a timeout": { plansLoad: { status: "unavailable", failure: "timeout" }, cardLoad: { status: "unavailable", failure: "timeout" } },
  "an invalid body": { plansLoad: { status: "unavailable", failure: "invalid" }, cardLoad: { status: "unavailable", failure: "invalid" } },
  "still loading": { plansLoad: { status: "loading" }, cardLoad: { status: "loading" } },
  "success": {
    plans: [{ id: "FREE", name: "ATARA", sponsoredSendsPerMonth: 10, milesPerUsd: 1, cardFxBps: 90 }, { id: "PLUS", name: "ATARA Plus", sponsoredSendsPerMonth: 60, milesPerUsd: 2, cardFxBps: 50 }],
    mine: { plan: "FREE", milesBalance: 0, monthlyCardSpendUsdCents: 0 },
    card: { available: false, state: "unavailable", canAddToWallet: false, waitlisted: false },
  },
};

test("Plans & Miles is never empty: in every scenario it shows the three plans and the Miles section", () => {
  for (const [name, state] of Object.entries(SCENARIOS)) {
    fresh();
    withState(state);
    const tree = render(PlansScreen);
    const text = textOf(tree);
    for (const shown of ["Plans & Miles", "ATARA Plans", "Current plan", "ATARA Plus", "ATARA Max", "Coming soon", "Available soon", "ATARA Miles", "Miles balance: 0", "Card rewards coming soon"]) {
      assert.ok(text.includes(shown), `${name}: missing "${shown}"`);
    }
    assert.equal(elements(tree).filter((n) => n.type === "LoadNotice").length, 1, `${name}: the notice slot is there`);
    assert.ok(elements(tree).some((n) => n.type === "SafeAreaView"), name);
    assert.doesNotMatch(text, /vault|undefined|NaN|null/i, name);
  }
});

test("Plans & Miles tells the person what failed, through the notice, and offers a retry", () => {
  fresh();
  withState(SCENARIOS["an older service (404)"]);
  const notice = elements(render(PlansScreen)).find((n) => n.type === "LoadNotice");
  assert.equal(notice.props.notice.kind, "unavailable");
  assert.match(notice.props.notice.text, /not available yet/);
  notice.props.onRetry();
  assert.deepEqual(pushes, ["refresh"]);
});

test("ATARA Card is never empty either, and always offers Notify me while there is no card", () => {
  for (const [name, state] of Object.entries(SCENARIOS)) {
    fresh();
    withState(state);
    const tree = render(CardScreen);
    const text = textOf(tree);
    for (const shown of ["ATARA Card", "Virtual Visa card", "Coming soon", "Spend your digital assets anywhere Visa is accepted.", "Apple Pay", "ATARA Miles", "Earn rewards when the card launches.", "Notify me", "Payment QR", "Pay a merchant"]) {
      assert.ok(text.includes(shown), `${name}: missing "${shown}"`);
    }
    // No invented card: no digits, no "Active", no card number.
    assert.doesNotMatch(text, /\d{4}|Active|ending/, name);
    assert.doesNotMatch(text, /undefined|NaN|null/, name);
  }
});

test("Notify me records the request once, says so, and a failure is said honestly", async () => {
  fresh();
  withState(SCENARIOS.success);
  const press = () => elements(render(CardScreen)).find((n) => n.type === "Pressable" && textOf(n) === "Notify me");
  await press().props.onPress();
  assert.equal(waitlistCalls, 1);
  assert.deepEqual(alerts.map((a) => a.slice(0, 2)), [["success", "You’re on the list"]]);

  fresh();
  withState(SCENARIOS.success);
  waitlistResult = "404";
  await press().props.onPress();
  assert.equal(alerts[0][0], "error");
  assert.match(alerts[0][2], /not available yet/);

  fresh();
  withState(SCENARIOS.success);
  waitlistResult = "offline";
  await press().props.onPress();
  assert.match(alerts[0][2], /offline/);
  // After a failure the button is usable again.
  assert.equal(press().props.disabled, false);
});

test("an account already on the list sees it, and cannot join twice", () => {
  fresh();
  withState({ card: { available: false, state: "unavailable", canAddToWallet: false, waitlisted: true } });
  const button = elements(render(CardScreen)).find((n) => n.type === "Pressable" && textOf(n).includes("on the list"));
  assert.equal(button.props.disabled, true);
});

test("the QR payment and the back button work from the card screen", () => {
  fresh();
  withState(SCENARIOS.success);
  const tree = render(CardScreen);
  elements(tree).find((n) => n.type === "Pressable" && textOf(n) === "Pay a merchant").props.onPress();
  elements(tree).find((n) => n.props?.accessibilityLabel === "Back").props.onPress();
  assert.deepEqual(pushes, ["/pay-merchant", "back"]);
});

test("the notice component draws its text, a spinner only while loading, and a retry only when asked", () => {
  const loading = LoadNotice({ notice: { kind: "loading", text: "Loading your plan…", canRetry: false } });
  assert.ok(elements(loading).some((n) => n.type === "ActivityIndicator"));
  assert.equal(elements(loading).some((n) => n.type === "Pressable"), false);
  let retried = 0;
  const failed = LoadNotice({ notice: { kind: "unavailable", text: "Live details are unavailable right now.", canRetry: true }, onRetry: () => retried++ });
  assert.equal(elements(failed).some((n) => n.type === "ActivityIndicator"), false);
  elements(failed).find((n) => n.type === "Pressable").props.onPress();
  assert.equal(retried, 1);
  assert.equal(LoadNotice({ notice: null }), null);
});
