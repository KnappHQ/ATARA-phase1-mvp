const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/**
 * Renders the account screens' components with the React and React Native
 * boundaries replaced by plain objects, so a component that throws while
 * rendering, or whose buttons are wired to the wrong call, is found here and
 * not on a phone. It is a logic simulation: it does not draw anything and it is
 * not an iOS device.
 */

let cursor = 0;
let slots = [];
const react = {
  useState: (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [
      slots[index],
      (next) => {
        slots[index] = typeof next === "function" ? next(slots[index]) : next;
      },
    ];
  },
  useEffect: () => {},
};
const jsx = (type, props, key) => ({ type, props: { ...props, ...(key === undefined ? {} : { key }) } });
const host = (name) => name;
const reactNative = {
  ActivityIndicator: host("ActivityIndicator"),
  KeyboardAvoidingView: host("KeyboardAvoidingView"),
  Modal: host("Modal"),
  Platform: { OS: "ios" },
  Pressable: host("Pressable"),
  ScrollView: host("ScrollView"),
  Text: host("Text"),
  TextInput: host("TextInput"),
  TouchableOpacity: host("TouchableOpacity"),
  View: host("View"),
};

const cache = {};
const load = (relativePath, mocks = {}) => {
  const file = path.join(__dirname, "..", relativePath);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: relativePath,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  const localRequire = (specifier) => {
    if (specifier in mocks) return mocks[specifier];
    if (specifier.startsWith("@/")) {
      const target = `${specifier.slice(2)}.ts`;
      if (fs.existsSync(path.join(__dirname, "..", target))) return (cache[target] ??= load(target, mocks));
    }
    if (specifier.startsWith(".")) {
      const target = path.relative(path.join(__dirname, ".."), path.join(path.dirname(file), specifier));
      for (const extension of [".ts", ".tsx"]) {
        if (fs.existsSync(path.join(__dirname, "..", target + extension))) {
          return (cache[target + extension] ??= load(target + extension, mocks));
        }
      }
    }
    throw new Error(`Missing mock: ${specifier} (from ${relativePath})`);
  };
  new Function("exports", "require", code)(exports, localRequire);
  return exports;
};

const COLORS = { white: "#fff", black: "#000", accent: "#dfccb1", placeholder: "#666", checkmark: "#0f0" };
const commonMocks = {
  react,
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react-native": reactNative,
  "react-native-safe-area-context": { SafeAreaView: host("SafeAreaView") },
  moti: { MotiView: host("MotiView") },
  "lucide-react-native": new Proxy({}, { get: (_, name) => host(String(name)) }),
  "expo-haptics": {
    impactAsync: () => {},
    notificationAsync: () => {},
    ImpactFeedbackStyle: {},
    NotificationFeedbackType: {},
  },
  "@/utils/constants": { COLORS },
  "@/components/onboarding/CrownIcon": { CrownIcon: host("CrownIcon") },
  "./CrownIcon": { CrownIcon: host("CrownIcon") },
};

const { AccountNameSheet } = load("components/accounts/AccountNameSheet.tsx", commonMocks);
const { ConfirmSheet } = load("components/accounts/ConfirmSheet.tsx", commonMocks);
const { GateScreen } = load("components/onboarding/GateScreen.tsx", {
  ...commonMocks,
  "@/components/accounts/AccountNameSheet": { AccountNameSheet },
});

// ------------------------------------------------------------ tree helpers

const children = (node) => {
  const value = node?.props?.children;
  return value === undefined || value === null ? [] : Array.isArray(value) ? value.flat(Infinity) : [value];
};
const walk = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node !== "object") return [node];
  return [node, ...children(node).flatMap(walk)];
};
// A custom component is not called by this mini runtime: what it would draw
// from its `label` prop is read from the prop.
const textOf = (node) =>
  walk(node)
    .flatMap((part) =>
      typeof part === "string" || typeof part === "number"
        ? [part]
        : typeof part?.type === "function" && typeof part.props?.label === "string"
          ? [part.props.label]
          : [],
    )
    .join("");
const elements = (tree) => walk(tree).filter((part) => part && typeof part === "object");
const findByText = (tree, wanted, type) =>
  elements(tree).find((node) => (!type || node.type === type) && textOf(node).includes(wanted) && textOf(node).length <= wanted.length + 60);
/** The innermost pressable that contains this text. */
const pressableWith = (tree, wanted) => {
  const candidates = elements(tree).filter(
    (node) => (node.type === "TouchableOpacity" || node.type === "Pressable") && textOf(node).includes(wanted),
  );
  return candidates.sort((a, b) => textOf(a).length - textOf(b).length)[0];
};
const button = (tree, label) =>
  elements(tree).find((node) => node.props?.label === label || (node.type === "Pressable" && textOf(node) === label));
const buttons = (tree, label) =>
  elements(tree).filter((node) => node.props?.label === label || (node.type === "Pressable" && textOf(node) === label));
const fresh = () => {
  slots = [];
  cursor = 0;
};
const render = (component, props) => {
  cursor = 0;
  return component(props);
};

// ------------------------------------------------------------------- gate

const gateProps = (overrides = {}) => {
  const calls = [];
  return {
    calls,
    props: {
      isPrivyReady: true,
      onStartPasskey: (...args) => calls.push(["passkey", ...args]),
      onStartOAuth: (...args) => calls.push(["oauth", ...args]),
      onResetSession: () => calls.push(["reset"]),
      takenNames: ["Tanguy — Tests"],
      suggestedName: "Account 7KQ2",
      onDismissIntent: () => calls.push(["dismiss"]),
      ...overrides,
    },
  };
};

process.env.EXPO_PUBLIC_PASSKEY_RP_ID = "api.atara.finance";

test("the gate renders, and creating an account opens the naming sheet instead of starting the passkey", () => {
  fresh();
  const { props, calls } = gateProps();
  let tree = render(GateScreen, props);
  assert.ok(pressableWith(tree, "Create with a passkey"));
  assert.ok(pressableWith(tree, "Sign in with an existing passkey"));
  let sheet = elements(tree).find((node) => node.type === AccountNameSheet);
  assert.equal(sheet.props.isOpen, false);

  pressableWith(tree, "Create with a passkey").props.onPress();
  assert.deepEqual(calls, [], "no passkey exists before a name has been chosen");

  tree = render(GateScreen, props);
  sheet = elements(tree).find((node) => node.type === AccountNameSheet);
  assert.equal(sheet.props.isOpen, true);
  assert.equal(sheet.props.initialValue, "Account 7KQ2");
  assert.deepEqual(sheet.props.taken, ["Tanguy — Tests"]);
  // The sheet says the name is private, and that iOS cannot be renamed later.
  assert.match(sheet.props.description, /only you will see/);
  assert.match(sheet.props.description, /ATARA never receives it/);
  assert.match(sheet.props.footnote, /cannot be changed in iOS afterwards/);
});

test("the chosen name reaches the passkey flow once the sheet has closed", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  fresh();
  const { props, calls } = gateProps();
  pressableWith(render(GateScreen, props), "Create with a passkey").props.onPress();
  const sheet = elements(render(GateScreen, props)).find((node) => node.type === AccountNameSheet);

  sheet.props.onConfirm("Tanguy — Perso");
  assert.deepEqual(calls, [], "iOS must not open its sheet over one that is still closing");
  context.mock.timers.tick(400);
  assert.deepEqual(calls, [["passkey", "signup", { label: "Tanguy — Perso" }]]);
});

test("the gate does not offer signing up while Privy or the domain is not ready", () => {
  fresh();
  const notReady = gateProps({ isPrivyReady: false });
  const tree = render(GateScreen, notReady.props);
  assert.equal(pressableWith(tree, "Create with a passkey").props.disabled, true);
  assert.equal(pressableWith(tree, "Sign in with an existing passkey").props.disabled, true);
});

const switchIntent = (plan) => ({
  kind: "switch",
  target: { accountKey: "k1", label: "Tanguy — Tests", handle: "tanguy41", privyUserId: "did:privy:1", plan },
});

test("after Switch, the gate shows only the account just chosen and continues with its own passkey", () => {
  fresh();
  const { props, calls } = gateProps({ intent: switchIntent({ method: "passkey", credentialId: "cred-a" }) });
  const tree = render(GateScreen, props);
  assert.ok(findByText(tree, "Switching to “Tanguy — Tests”"));
  assert.match(textOf(tree), /@tanguy41/);
  pressableWith(tree, "Continue with this account's passkey").props.onPress();
  // Only that credential is offered, and the switch is not dismissed by its own button.
  assert.deepEqual(calls, [["passkey", "login", { credentialId: "cred-a" }]]);
});

test("choosing another way at the gate ends the switch, so its result is not judged as a mistake", () => {
  fresh();
  const { props, calls } = gateProps({ intent: switchIntent({ method: "passkey", credentialId: "cred-a" }) });
  pressableWith(render(GateScreen, props), "Sign in with an existing passkey").props.onPress();
  assert.deepEqual(calls, [["dismiss"], ["passkey", "login"]]);

  fresh();
  const google = gateProps({ intent: switchIntent({ method: "passkey", credentialId: "cred-a" }) });
  pressableWith(render(GateScreen, google.props), "Google").props.onPress();
  assert.deepEqual(google.calls, [["dismiss"], ["oauth", "google"]]);

  fresh();
  const banner = gateProps({ intent: switchIntent({ method: "passkey", credentialId: "cred-a" }) });
  pressableWith(render(GateScreen, banner.props), "Choose another way").props.onPress();
  assert.deepEqual(banner.calls, [["dismiss"]]);
});

test("a switch to a Google or Apple account continues with that provider; an unknown method offers no shortcut", () => {
  fresh();
  const google = gateProps({ intent: switchIntent({ method: "oauth", provider: "google" }) });
  pressableWith(render(GateScreen, google.props), "Continue with Google").props.onPress();
  assert.deepEqual(google.calls, [["oauth", "google"]]);

  fresh();
  const apple = gateProps({ intent: switchIntent({ method: "oauth", provider: "apple" }) });
  assert.ok(pressableWith(render(GateScreen, apple.props), "Continue with Apple"));

  fresh();
  const choose = gateProps({ intent: switchIntent({ method: "choose" }) });
  const tree = render(GateScreen, choose.props);
  assert.ok(findByText(tree, "Switching to “Tanguy — Tests”"));
  assert.equal(pressableWith(tree, "Continue with"), undefined);
});

test("adding another account says the others stay, and can be dismissed", () => {
  fresh();
  const { props, calls } = gateProps({ intent: { kind: "add" } });
  const tree = render(GateScreen, props);
  assert.match(textOf(tree), /Adding another account/);
  assert.match(textOf(tree), /Your other accounts stay on this iPhone/);
  pressableWith(tree, "Dismiss").props.onPress();
  assert.deepEqual(calls, [["dismiss"]]);
});

test("the gate lists no account of the phone: nothing but what it was handed is on screen", () => {
  fresh();
  const { props } = gateProps();
  const tree = render(GateScreen, props);
  // Names only reach the naming sheet, as names to avoid; nothing is rendered as an account.
  assert.doesNotMatch(textOf(tree), /Tanguy — Tests/);
});

// ------------------------------------------------------------ naming sheet

const sheetProps = (overrides = {}) => {
  const calls = [];
  return {
    calls,
    props: {
      isOpen: true,
      title: "Name this account",
      description: "A private name.",
      initialValue: "Account 7KQ2",
      confirmLabel: "Create passkey",
      taken: ["Tanguy — Tests"],
      onCancel: () => calls.push("cancel"),
      onConfirm: async (label) => {
        calls.push(`confirm:${label}`);
      },
      ...overrides,
    },
  };
};
const inputOf = (tree) => elements(tree).find((node) => node.type === "TextInput");

test("the naming sheet refuses a taken, empty, too long or reserved name and passes a good one", async () => {
  fresh();
  const { props, calls } = sheetProps();
  const type = (text) => inputOf(render(AccountNameSheet, props)).props.onChangeText(text);
  const submit = () => pressableWith(render(AccountNameSheet, props), "Create passkey").props.onPress();
  const error = () => textOf(render(AccountNameSheet, props));

  type("tanguy — TESTS");
  await submit();
  assert.match(error(), /Another account on this iPhone already has this name/);

  type("   ");
  await submit();
  assert.match(error(), /Choose a name/);

  type("atara");
  await submit();
  assert.match(error(), /iOS already lists older passkeys as “ATARA”/);

  assert.deepEqual(calls, [], "nothing was confirmed with a refused name");

  type("Tanguy — Démo");
  await submit();
  assert.deepEqual(calls, ["confirm:Tanguy — Démo"]);
});

test("a name that could not be saved is shown and the sheet stays open", async () => {
  fresh();
  const { props } = sheetProps({
    onConfirm: async () => {
      throw new Error("Storage is full.");
    },
  });
  await pressableWith(render(AccountNameSheet, props), "Create passkey").props.onPress();
  assert.match(textOf(render(AccountNameSheet, props)), /Storage is full\./);
});

// ------------------------------------------------------------ confirmation

test("account deletion cannot be confirmed without typing DELETE and acknowledging the funds", async () => {
  fresh();
  const calls = [];
  const props = {
    isOpen: true,
    title: "Delete your ATARA account?",
    destructive: true,
    confirmLabel: "Delete my ATARA account",
    typedConfirmation: "DELETE",
    acknowledgement: "I hold 12.5 USDC. It stays at 0x1234…5678.",
    children: "effects",
    onCancel: () => calls.push("cancel"),
    onConfirm: async () => {
      calls.push("confirm");
    },
  };
  const button = () => pressableWith(render(ConfirmSheet, props), "Delete my ATARA account");
  const checkbox = () => elements(render(ConfirmSheet, props)).find((node) => node.props?.accessibilityRole === "checkbox");
  const typing = () => elements(render(ConfirmSheet, props)).find((node) => node.type === "TextInput");

  assert.equal(button().props.disabled, true);
  await button().props.onPress();
  assert.deepEqual(calls, [], "a disabled confirmation does nothing");

  checkbox().props.onPress();
  assert.equal(button().props.disabled, true, "acknowledging is not enough");
  typing().props.onChangeText("delet");
  assert.equal(button().props.disabled, true, "a partial word is not enough");
  typing().props.onChangeText(" delete ");
  assert.equal(button().props.disabled, false);

  await button().props.onPress();
  assert.deepEqual(calls, ["confirm"]);
});

test("without funds there is nothing to acknowledge, and a failed confirmation is reported and changes nothing", async () => {
  fresh();
  const props = {
    isOpen: true,
    title: "Remove account",
    confirmLabel: "Remove from this iPhone",
    children: "effects",
    onCancel: () => {},
    onConfirm: async () => {
      throw new Error("Could not sign out.");
    },
  };
  const button = () => pressableWith(render(ConfirmSheet, props), "Remove from this iPhone");
  assert.equal(button().props.disabled, false);
  await button().props.onPress();
  assert.match(textOf(render(ConfirmSheet, props)), /Could not sign out\./);
});

test("a confirmation that is closed draws nothing to confirm by accident", () => {
  fresh();
  const tree = render(ConfirmSheet, {
    isOpen: false,
    title: "x",
    confirmLabel: "Delete",
    children: null,
    onCancel: () => {},
    onConfirm: async () => {},
  });
  assert.equal(tree.props.visible, false);
});

// ------------------------------------------------------------ Manage accounts

const reactWithMemo = { ...react, useMemo: (compute) => compute() };
const events = [];
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
  createdAt: 1,
  lastUsedAt: 3,
  profileDeletedAt: null,
  ...over,
});

const manageScreen = (accounts, { renameResult } = {}) => {
  events.length = 0;
  const registryState = {
    accounts,
    rename: async (key, label) => {
      events.push(`rename:${key}:${label}`);
      return renameResult ?? { ok: true, label };
    },
    remove: async (key) => {
      events.push(`forget-entry:${key}`);
    },
  };
  const useAccountRegistryStore = (selector) => selector(registryState);
  useAccountRegistryStore.getState = () => registryState;
  const useAccountSwitchStore = { getState: () => ({ begin: (intent) => events.push(`begin:${intent.kind}`), clear: () => events.push("clear") }) };
  const useAddressBookStore = { getState: () => ({ forget: (id) => events.push(`forget-nicknames:${id}`) }) };
  const router = { back: () => events.push("back"), push: (to) => events.push(`push:${to}`) };
  const DeleteAccountModal = host("DeleteAccountModal");
  const mocks = {
    ...commonMocks,
    react: reactWithMemo,
    "expo-router": { useRouter: () => router },
    "@privy-io/expo": { usePrivy: () => ({ user: { id: "did:privy:1" } }) },
    "@/providers/AuthProvider": { useAuth: () => ({ logout: async () => events.push("logout") }) },
    "@/components/accounts/AccountNameSheet": { AccountNameSheet },
    "@/components/accounts/ConfirmSheet": { ConfirmSheet },
    "@/components/profile/DeleteAccountModal": { DeleteAccountModal },
    "@/stores/useAccountRegistryStore": { useAccountRegistryStore },
    "@/stores/useAccountSwitchStore": { useAccountSwitchStore },
    "@/stores/useAddressBookStore": { useAddressBookStore },
    "@/stores/useAuthStore": { useAuthStore: (selector) => selector({ user: { id: "u1", handle: "tanguy41" } }) },
  };
  const screen = load("app/manage-accounts.tsx", mocks).default;
  return { screen, DeleteAccountModal };
};
const sheetOf = (tree, Component) => elements(tree).find((node) => node.type === Component);

test("Manage accounts lists each account with its private name, @handle and short address, and marks the active one", () => {
  fresh();
  const accounts = [
    account({ key: "a", label: "Tanguy — Tests", lastUsedAt: 5 }),
    account({ key: "b", privyUserId: "did:privy:2", userId: "u2", handle: "demo", label: "Tanguy — Démo", lastUsedAt: 9, smartAccountAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" }),
    account({ key: "c", privyUserId: "did:privy:3", userId: null, handle: null, label: "Account 7KQ2", lastUsedAt: 1, smartAccountAddress: null }),
  ];
  const { screen } = manageScreen(accounts);
  const tree = render(screen, {});
  const text = textOf(tree);
  for (const shown of ["Tanguy — Tests", "Tanguy — Démo", "Account 7KQ2", "@tanguy41", "@demo", "Setup not finished", "0x1234…5678", "0xabcd…abcd"]) {
    assert.ok(text.includes(shown), shown);
  }
  // Only the signed-in account (matched by Privy user id) is Active, and it comes first.
  assert.equal(text.match(/Active/g).length, 1);
  assert.ok(text.indexOf("Tanguy — Tests") < text.indexOf("Tanguy — Démo"));
  // Its own actions: passkeys and deleting the ATARA account. The others can be switched to.
  assert.equal(buttons(tree, "Delete ATARA account").length, 1);
  assert.equal(buttons(tree, "Switch").length, 2);
  assert.equal(buttons(tree, "Remove from this iPhone").length, 3);
  // The private name is described as staying on the phone.
  assert.match(text, /never receives it/);
});

test("two accounts that share a private name are still told apart on screen", () => {
  fresh();
  const { screen } = manageScreen([
    account({ key: "a", label: "Perso" }),
    account({ key: "b", privyUserId: "did:privy:2", userId: "u2", handle: "bob", label: "perso" }),
  ]);
  const text = textOf(render(screen, {}));
  assert.ok(text.includes("Perso · @tanguy41"));
  assert.ok(text.includes("perso · @bob"));
});

test("a passkey made before names existed is described as probably \"ATARA\", never as certainly", () => {
  fresh();
  const { screen } = manageScreen([
    account({ passkeys: [{ credentialId: "old", name: null, createdAt: 1, verifiedAt: null, origin: "existing" }] }),
  ]);
  const text = textOf(render(screen, {}));
  assert.match(text, /1 passkey created before names existed\. iOS probably lists it as “ATARA”\./);
});

test("Switch signs out only after remembering the target, and the sheet says what happens to the data", async () => {
  fresh();
  const accounts = [
    account({ key: "a" }),
    account({ key: "b", privyUserId: "did:privy:2", userId: "u2", handle: "demo", label: "Tanguy — Démo",
      passkeys: [{ credentialId: "cred-b", name: "Tanguy — Démo", createdAt: 1, verifiedAt: 2, origin: "atara" }] }),
  ];
  const { screen } = manageScreen(accounts);
  const switchButton = () => button(render(screen, {}), "Switch");
  switchButton().props.onPress();

  const tree = render(screen, {});
  const confirm = elements(tree).filter((node) => node.type === ConfirmSheet).find((node) => node.props.isOpen);
  assert.equal(confirm.props.title, "Switch to “Tanguy — Démo”?");
  const text = textOf(confirm);
  assert.match(text, /Its funds and data are not touched, and unfinished payments stay with it/);
  assert.match(text, /its passkey\. iOS will ask for Face ID/);

  await confirm.props.onConfirm();
  assert.deepEqual(events, ["begin:switch", "logout"]);
});

test("Remove from this iPhone signs the active account out first, then forgets it and its nicknames, and says what it keeps", async () => {
  fresh();
  const { screen } = manageScreen([account({ key: "a" })]);
  const removeButton = () => button(render(screen, {}), "Remove from this iPhone");
  removeButton().props.onPress();

  const confirm = elements(render(screen, {})).filter((node) => node.type === ConfirmSheet).find((node) => node.props.isOpen);
  assert.equal(confirm.props.destructive, true);
  const text = textOf(confirm);
  assert.match(text, /You will be signed out\./);
  assert.match(text, /Nothing is deleted from ATARA or from the blockchain/);
  assert.match(text, /Its passkey stays in iOS \(Settings › Passwords\)/);

  await confirm.props.onConfirm();
  assert.deepEqual(events, ["logout", "forget-entry:a", "forget-nicknames:u1"]);
});

test("removing an account that is not the active one leaves the current session alone", async () => {
  fresh();
  const { screen } = manageScreen([
    account({ key: "a" }),
    account({ key: "b", privyUserId: "did:privy:2", userId: "u2", handle: "demo", label: "Tanguy — Démo" }),
  ]);
  const removeButtons = buttons(render(screen, {}), "Remove from this iPhone");
  removeButtons[1].props.onPress();
  const confirm = elements(render(screen, {})).filter((node) => node.type === ConfirmSheet).find((node) => node.props.isOpen);
  assert.doesNotMatch(textOf(confirm), /You will be signed out\./);
  await confirm.props.onConfirm();
  assert.deepEqual(events, ["forget-entry:b", "forget-nicknames:u2"]);
});

test("renaming is private, is checked against the other accounts, and says iOS keeps its own name", async () => {
  fresh();
  const named = [{ credentialId: "cred-a", name: "Tanguy — Tests", createdAt: 1, verifiedAt: 2, origin: "atara" }];
  const { screen } = manageScreen([account({ key: "a", passkeys: named }), account({ key: "b", privyUserId: "did:privy:2", userId: "u2", handle: "demo", label: "Tanguy — Démo" })]);
  const renameButton = () => button(render(screen, {}), "Rename");
  renameButton().props.onPress();

  const sheet = elements(render(screen, {})).find((node) => node.type === AccountNameSheet && node.props.isOpen);
  assert.equal(sheet.props.initialValue, "Tanguy — Tests");
  // Its own name is not "taken"; the other account's is.
  assert.deepEqual(sheet.props.taken, ["Tanguy — Démo"]);
  assert.match(sheet.props.description, /ATARA never receives it/);
  assert.match(sheet.props.footnote, /does not rename the passkey in iOS: iOS keeps showing “Tanguy — Tests”/);

  await sheet.props.onConfirm("Tanguy — Perso");
  assert.deepEqual(events, ["rename:a:Tanguy — Perso"]);
});

test("a rename the registry refuses is reported and the sheet stays open", async () => {
  fresh();
  const { screen } = manageScreen([account({ key: "a" })], { renameResult: { ok: false, reason: "duplicate", label: "x" } });
  button(render(screen, {}), "Rename").props.onPress();
  const sheet = elements(render(screen, {})).find((node) => node.type === AccountNameSheet && node.props.isOpen);
  await assert.rejects(sheet.props.onConfirm("x"), /Another account on this iPhone already has this name/);
  // Still open: the person can pick another name.
  assert.ok(elements(render(screen, {})).find((node) => node.type === AccountNameSheet && node.props.isOpen));
});

test("Add another account signs out only after the person confirms, and leads to the gate's banner", async () => {
  fresh();
  const { screen } = manageScreen([account({ key: "a" })]);
  const before = elements(render(screen, {})).filter((node) => node.type === ConfirmSheet).find((node) => node.props.isOpen);
  assert.equal(before, undefined);
  pressableWith(render(screen, {}), "Add another account").props.onPress();
  const confirm = elements(render(screen, {})).filter((node) => node.type === ConfirmSheet).find((node) => node.props.isOpen);
  assert.equal(confirm.props.title, "Add another account?");
  assert.deepEqual(events, [], "nothing happens before the confirmation");
  await confirm.props.onConfirm();
  assert.deepEqual(events, ["begin:add", "logout"]);
});

test("Delete ATARA account and Passkeys & sign-in are reachable from the active account only", () => {
  fresh();
  const { screen, DeleteAccountModal } = manageScreen([
    account({ key: "a" }),
    account({ key: "b", privyUserId: "did:privy:2", userId: "u2", handle: "demo", label: "Tanguy — Démo" }),
  ]);
  const tree = render(screen, {});
  assert.equal(sheetOf(tree, DeleteAccountModal).props.isOpen, false);
  button(tree, "Delete ATARA account").props.onPress();
  assert.equal(sheetOf(render(screen, {}), DeleteAccountModal).props.isOpen, true);

  button(render(screen, {}), "Passkeys & sign-in").props.onPress();
  assert.ok(events.includes("push:/sign-in-methods"));
  assert.match(textOf(render(screen, {})), /Deleting an ATARA account needs that account to be signed in, so switch to it first/);
});

// ------------------------------------------------------------ Passkeys & sign-in

const signInScreen = ({ passkeys, methods, account: current, privyUser }) => {
  events.length = 0;
  const registryState = { accounts: [current] };
  const useAccountRegistryStore = (selector) => selector(registryState);
  useAccountRegistryStore.getState = () => registryState;
  const management = {
    isAvailable: true,
    account: current,
    passkeys,
    methods,
    privyUser,
    hasDomain: true,
    add: async (label) => {
      events.push(`add:${label}`);
      return { ok: true, label };
    },
    test: async (id) => {
      events.push(`test:${id}`);
      return { ok: true };
    },
    remove: async (id) => {
      events.push(`remove:${id}`);
      return { ok: true };
    },
  };
  const mocks = {
    ...commonMocks,
    react: reactWithMemo,
    "expo-router": { useRouter: () => ({ back: () => events.push("back") }) },
    "@/components/accounts/AccountNameSheet": { AccountNameSheet },
    "@/components/accounts/ConfirmSheet": { ConfirmSheet },
    "@/hooks/usePasskeyManagement": { usePasskeyManagement: () => management },
    "@/stores/useAccountRegistryStore": { useAccountRegistryStore },
  };
  return load("app/sign-in-methods.tsx", mocks).default;
};
const summary = (id, extra = {}) => ({ credentialId: id, enrolledInMfa: false, firstVerifiedAt: 1_700_000_000, latestVerifiedAt: 1_700_100_000, ...extra });
const linked = (id) => ({ type: "passkey", credential_id: id });

test("the last way to sign in cannot be removed, and the person is told why without contacting Privy", () => {
  fresh();
  const current = account({ passkeys: [{ credentialId: "only", name: "Tanguy — Tests", createdAt: 1, verifiedAt: 2, origin: "atara" }] });
  const screen = signInScreen({
    passkeys: [summary("only")],
    methods: [{ kind: "passkey", id: "only", label: "Passkey" }],
    account: current,
    privyUser: { linked_accounts: [linked("only"), { type: "wallet" }] },
  });
  button(render(screen, {}), "Remove").props.onPress();
  const tree = render(screen, {});
  assert.match(textOf(tree), /This is the only way to sign in to this account/);
  assert.equal(elements(tree).filter((node) => node.type === ConfirmSheet).find((node) => node.props.isOpen), undefined);
  assert.deepEqual(events, []);
});

test("removing a passkey lists what will still work, and reminds that iOS keeps its copy", async () => {
  fresh();
  const current = account({ passkeys: [{ credentialId: "old", name: null, createdAt: 1, verifiedAt: null, origin: "existing" }] });
  const screen = signInScreen({
    passkeys: [summary("old")],
    methods: [{ kind: "passkey", id: "old", label: "Passkey" }, { kind: "google", id: "google", label: "Google account" }],
    account: current,
    privyUser: { linked_accounts: [linked("old"), { type: "google_oauth" }] },
  });
  const tree0 = render(screen, {});
  // A legacy passkey is shown as such, with its dates, and can be tested or removed.
  assert.match(textOf(tree0), /Passkey created before names existed/);
  assert.match(textOf(tree0), /iOS probably lists it as “ATARA”/);
  assert.match(textOf(tree0), /Not checked on this iPhone yet/);

  button(tree0, "Remove").props.onPress();
  const confirm = elements(render(screen, {})).filter((node) => node.type === ConfirmSheet).find((node) => node.props.isOpen);
  const text = textOf(confirm);
  assert.match(text, /You will still be able to sign in with: Google account/);
  assert.match(text, /iOS keeps its copy of the passkey until you delete it yourself in Settings › Passwords/);

  await confirm.props.onConfirm();
  assert.deepEqual(events, ["remove:old"]);
});

test("testing a passkey and adding a named one go through the account's own actions", async () => {
  fresh();
  const current = account({ passkeys: [{ credentialId: "a", name: "Tanguy — Tests", createdAt: 1, verifiedAt: 2, origin: "atara" }] });
  const screen = signInScreen({
    passkeys: [summary("a")],
    methods: [{ kind: "passkey", id: "a", label: "Passkey" }],
    account: current,
    privyUser: { linked_accounts: [linked("a")] },
  });
  await button(render(screen, {}), "Test").props.onPress();
  assert.deepEqual(events, ["test:a"]);
  assert.match(textOf(render(screen, {})), /This passkey works on this iPhone\./);

  pressableWith(render(screen, {}), "Add a named passkey").props.onPress();
  const sheet = elements(render(screen, {})).find((node) => node.type === AccountNameSheet && node.props.isOpen);
  // The proposal is unused by every account and every passkey on this phone.
  assert.equal(sheet.props.initialValue, "Tanguy — Tests · 2");
  assert.ok(sheet.props.taken.includes("Tanguy — Tests"));
  assert.match(sheet.props.description, /ATARA never receives it/);
  await sheet.props.onConfirm("Tanguy — Tests · 2");
  assert.equal(events.at(-1), "add:Tanguy — Tests · 2");
});

// ------------------------------------------------------- passkey management hook

const passkeyHook = ({ user, createFails, linkFails, unlinkFails, refreshedUser, testResult } = {}) => {
  const log = [];
  const current = account({
    passkeys: [{ credentialId: "cred-a", name: "Tanguy — Tests", createdAt: 1, verifiedAt: 2, origin: "atara" }],
  });
  const registryState = {
    accounts: [current],
    addPasskey: async (key, input) => log.push(["addPasskey", key, input.credentialId, input.name]),
    markVerified: async (key, id) => log.push(["markVerified", key, id]),
    removePasskey: async (key, id) => log.push(["removePasskey", key, id]),
  };
  const useAccountRegistryStore = (selector) => selector(registryState);
  useAccountRegistryStore.getState = () => registryState;

  const client = {
    auth: {
      passkey: {
        generateRegistrationOptions: async () => ({
          options: {
            challenge: "chal",
            rp: { id: "api.atara.finance", name: "ATARA" },
            pub_key_cred_params: [{ type: "public-key", alg: -7 }],
            user: { id: "handle-1", name: "ATARA", display_name: "ATARA" },
            exclude_credentials: [{ id: "cred-a", type: "public-key" }],
          },
        }),
        linkWithPasskey: async () => {
          if (linkFails) throw new Error("Link failed");
          return { user: {} };
        },
      },
    },
  };
  const passkeys = {
    create: async (request) => {
      log.push(["create", request.user.name, request.user.id]);
      if (createFails) throw new Error(createFails);
      return { id: "cred-new", type: "public-key" };
    },
    get: async (request) => {
      log.push(["get", request.allowCredentials[0].id]);
      if (testResult === "cancelled") throw new Error("The user cancelled the request");
      return { id: request.allowCredentials[0].id };
    },
  };
  const privyUser = user ?? { id: "did:privy:1", linked_accounts: [{ type: "passkey", credential_id: "cred-a" }, { type: "google_oauth" }] };
  const mocks = {
    ...commonMocks,
    react: { ...react, useMemo: (compute) => compute(), useCallback: (fn) => fn },
    "@privy-io/expo": {
      usePrivy: () => ({
        user: privyUser,
        isReady: true,
        refreshUser: async () => {
          log.push(["refreshUser"]);
          return { user: refreshedUser ?? privyUser };
        },
      }),
      usePrivyClient: () => client,
      useUnlinkPasskey: () => ({
        unlink: async (input) => {
          log.push(["unlink", input.credentialId]);
          if (unlinkFails) throw new Error(unlinkFails);
        },
      }),
    },
    "@/services/passkeyRuntime": {
      createPasskeyDeps: () => ({ client, passkeys, randomBytes: (n) => new Uint8Array(n).fill(3) }),
      passkeyRelyingParty: () => "api.atara.finance",
      passkeyRelyingPartyUrl: () => "https://api.atara.finance",
      randomBytes: (n) => new Uint8Array(n).fill(3),
    },
    "@/stores/useAccountRegistryStore": { useAccountRegistryStore },
    "@/stores/useAuthStore": { useAuthStore: (selector) => selector({ user: { id: "u1", authProvider: "passkey" } }) },
  };
  return { hook: load("hooks/usePasskeyManagement.ts", mocks).usePasskeyManagement(), log, current };
};

test("adding a passkey creates it under the chosen name, links it, and records it on the account", async () => {
  const { hook, log, current } = passkeyHook();
  const result = await hook.add("Tanguy — Tests · 2");
  assert.deepEqual(result, { ok: true, label: "Tanguy — Tests · 2" });
  // The name handed to iOS is the chosen one, on Privy's own user handle.
  assert.deepEqual(log[0], ["create", "Tanguy — Tests · 2", "handle-1"]);
  assert.ok(log.some((entry) => entry[0] === "addPasskey" && entry[1] === current.key && entry[2] === "cred-new" && entry[3] === "Tanguy — Tests · 2"));
  assert.ok(log.some((entry) => entry[0] === "refreshUser"));
});

test("when iOS refuses a second passkey, nothing is recorded and the person is told why", async () => {
  const { hook, log } = passkeyHook({ createFails: "The operation couldn't be completed. matchedExcludedCredential" });
  const result = await hook.add("Tanguy — Tests · 2");
  assert.equal(result.ok, false);
  assert.equal(result.cancelled, false);
  assert.match(result.message, /iOS did not create the passkey/);
  assert.match(result.message, /Nothing was changed/);
  assert.equal(log.some((entry) => entry[0] === "addPasskey"), false);
});

test("cancelling the iOS sheet adds nothing and is not reported as a failure", async () => {
  const { hook, log } = passkeyHook({ createFails: "The user cancelled the request" });
  const result = await hook.add("Tanguy — Tests · 2");
  assert.deepEqual(result, { ok: false, cancelled: true, message: "Canceled. Nothing was added." });
  assert.equal(log.some((entry) => entry[0] === "addPasskey"), false);
});

test("a passkey created but not linked is reported by name and never recorded on the account", async () => {
  const { hook, log } = passkeyHook({ linkFails: true });
  const result = await hook.add("Tanguy — Tests · 2");
  assert.equal(result.ok, false);
  assert.match(result.message, /“Tanguy — Tests · 2” was created on this iPhone but could not be linked/);
  assert.equal(log.some((entry) => entry[0] === "addPasskey"), false);
});

test("a passkey that works on this iPhone is recorded as proven, and a cancelled test proves nothing", async () => {
  const ok = passkeyHook();
  assert.deepEqual(await ok.hook.test("cred-a"), { ok: true });
  assert.ok(ok.log.some((entry) => entry[0] === "markVerified" && entry[2] === "cred-a"));
  // Only that credential was asked of iOS.
  assert.deepEqual(ok.log.find((entry) => entry[0] === "get"), ["get", "cred-a"]);

  const cancelled = passkeyHook({ testResult: "cancelled" });
  const result = await cancelled.hook.test("cred-a");
  assert.equal(result.ok, false);
  assert.equal(cancelled.log.some((entry) => entry[0] === "markVerified"), false);
});

test("the registry forgets a passkey only after Privy confirms it is gone", async () => {
  const gone = passkeyHook({ refreshedUser: { id: "did:privy:1", linked_accounts: [{ type: "google_oauth" }] } });
  assert.deepEqual(await gone.hook.remove("cred-a"), { ok: true });
  assert.deepEqual(gone.log.filter((entry) => entry[0] === "unlink"), [["unlink", "cred-a"]]);
  assert.ok(gone.log.some((entry) => entry[0] === "removePasskey" && entry[2] === "cred-a"));

  const still = passkeyHook();
  assert.equal((await still.hook.remove("cred-a")).reason, "not-confirmed");
  assert.equal(still.log.some((entry) => entry[0] === "removePasskey"), false);

  const refused = passkeyHook({ unlinkFails: "MFA verification required" });
  assert.equal((await refused.hook.remove("cred-a")).reason, "failed");
  assert.equal(refused.log.some((entry) => entry[0] === "removePasskey"), false);
});

test("the last way to sign in is refused before Privy is contacted", async () => {
  const { hook, log } = passkeyHook({ user: { id: "did:privy:1", linked_accounts: [{ type: "passkey", credential_id: "cred-a" }, { type: "wallet" }] } });
  const outcome = await hook.remove("cred-a");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(log.some((entry) => entry[0] === "unlink"), false);
});
