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

// ---- B: saved onboarding draft ---------------------------------------------

const draft = load("utils/onboardingDraft.ts");
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

test("a draft is saved and restored per Privy user", () => {
  let drafts = {};
  drafts = draft.saveDraft(drafts, "user-a", { handle: "tanguy", accountName: "Personal" }, NOW);
  drafts = draft.saveDraft(drafts, "user-b", { handle: "other", accountName: "" }, NOW);
  assert.deepEqual(draft.readDraft(drafts, "user-a", NOW + 1000), { handle: "tanguy", accountName: "Personal", savedAt: NOW });
  assert.equal(draft.readDraft(drafts, "user-b", NOW).handle, "other");
  assert.equal(draft.readDraft(drafts, "user-c", NOW), null);
  assert.equal(draft.readDraft(drafts, null, NOW), null);
});

test("a draft older than 7 days is ignored and pruned", () => {
  const drafts = draft.saveDraft({}, "user-a", { handle: "tanguy", accountName: "" }, NOW);
  assert.ok(draft.readDraft(drafts, "user-a", NOW + 7 * DAY - 1));
  assert.equal(draft.readDraft(drafts, "user-a", NOW + 7 * DAY), null);
  assert.deepEqual(draft.pruneDrafts(drafts, NOW + 8 * DAY), {});
  assert.ok(draft.pruneDrafts(drafts, NOW + DAY)["user-a"]);
});

test("a draft is cleared on success and an empty draft is not kept", () => {
  let drafts = draft.saveDraft({}, "user-a", { handle: "tanguy", accountName: "" }, NOW);
  assert.deepEqual(draft.clearDraft(drafts, "user-a"), {});
  drafts = draft.saveDraft(drafts, "user-a", { handle: "", accountName: "  " }, NOW);
  assert.deepEqual(drafts, {});
});

test("only the handle, the account name and the time are stored; the terms tick never is", () => {
  const drafts = draft.saveDraft({}, "user-a", { handle: "tanguy", accountName: "Me", acceptedLegalTerms: true }, NOW);
  assert.deepEqual(Object.keys(drafts["user-a"]).sort(), ["accountName", "handle", "savedAt"]);
  // Malformed or padded stored data is rebuilt field by field.
  const loaded = draft.pruneDrafts({ "user-a": { handle: "x", accountName: "y", savedAt: NOW, acceptedLegalTerms: true }, bad: { handle: 3 } }, NOW);
  assert.deepEqual(Object.keys(loaded["user-a"]).sort(), ["accountName", "handle", "savedAt"]);
  assert.equal(loaded.bad, undefined);
});

test("onboarding wiring: restores on the identity step, clears after registering, never touches the terms", () => {
  const screen = read("app/onboarding.tsx");
  const store = read("stores/useOnboardingDraftStore.ts");
  assert.match(store, /atara\.onboardingDraft\.v1/);
  assert.match(screen, /usePrivy\(\)/);
  assert.match(screen, /DRAFT_SAVE_DELAY_MS = 300/);
  assert.match(screen, /await registerWithHandle\(params\);[\s\S]*clear\(userId\)/);
  assert.doesNotMatch(screen + store, /acceptedLegalTerms/);
  assert.doesNotMatch(store, /\bfetch\(|axios|api\./);
});

// ---- C: Back asks before signing out ---------------------------------------

test("Back asks first, then calls the unchanged sign-out", () => {
  const screen = read("components/onboarding/IdentityScreen.tsx");
  const gate = read("components/onboarding/GateScreen.tsx");
  assert.match(screen, /Alert\.alert\(\s*"Use a different sign-in\?"/);
  assert.match(screen, /text: "Stay", style: "cancel"/);
  assert.match(screen, /text: "Sign out", style: "destructive", onPress: \(\) => void signOut\(\)/);
  assert.match(screen, /await onBack\(\);/);
  assert.match(screen, /Sign-in options/);
  assert.match(screen, /accessibilityLabel="Sign out and choose another sign-in"/);
  assert.doesNotMatch(screen, /Back to sign-in methods/);
  // The alert names a button that really exists on the first screen.
  assert.match(gate, /Sign in with an existing passkey/);
  assert.match(screen, /Sign in with an existing passkey/);
});

test("signing out is still the app's own logout", () => {
  assert.match(read("app/onboarding.tsx"), /onBack=\{logout\}/);
});

// ---- D, E: step labels and why the email -----------------------------------

test("each onboarding screen says which step it is, and the Gate hides it when switching accounts", () => {
  const gate = read("components/onboarding/GateScreen.tsx");
  const identity = read("components/onboarding/IdentityScreen.tsx");
  assert.match(gate, /\{!intent && \(\s*<Text[^>]*>\s*Step 1 of 2 · Sign in/);
  assert.match(identity, /Step 2 of 2 · Your @handle/);
  assert.match(identity, /Get Started/);
});

test("the email line matches what the backend does", () => {
  const gate = read("components/onboarding/GateScreen.tsx").replace(/\s+/g, " ");
  assert.match(
    gate,
    /With Google or Apple, ATARA keeps the email address they share, only to recognise your account\. Other people never see it\./,
  );
  // Other people's profiles never include the email unless asked, and the profile route doesn't.
  const user = fs.readFileSync(path.join(__dirname, "..", "..", "backend", "services", "user.service.ts"), "utf8");
  const controller = fs.readFileSync(path.join(__dirname, "..", "..", "backend", "controllers", "user.controller.ts"), "utf8");
  assert.match(user, /\.\.\.\(includePrivate && \{ email: true \}\)/);
  assert.match(controller, /getUserByHandle\(handle\.toLowerCase\(\), false, req\.user\.id\)/);
});

// ---- F: pull to refresh -----------------------------------------------------

test("Home refreshes balance, activity and groups together, reads only", () => {
  const home = read("app/(tabs)/index.tsx");
  assert.match(home, /refreshControl=\{\s*<RefreshControl/);
  assert.match(home, /Promise\.allSettled\(\[\s*useWalletStore\.getState\(\)\.refreshBalances\(\),\s*fetchHistory\(\),\s*fetchGroups\(\),\s*\]\)/);
  assert.match(home, /finally \{\s*setIsRefreshing\(false\)/);
});

test("Group details refreshes in place without the loading skeleton", () => {
  const screen = read("app/group-details.tsx");
  const store = read("stores/useGroupStore.ts");
  assert.match(screen, /refreshControl=\{\s*<RefreshControl/);
  assert.match(screen, /fetchGroupDetail\(id, \{ silent: true \}\)/);
  assert.match(screen, /finally \{\s*setIsRefreshing\(false\)/);
  assert.match(store, /options\?\.silent \? \{ detailError: null \} : \{ isLoadingDetail: true, detailError: null \}/);
});

test("Activity pull also reloads group invitations", () => {
  const activity = read("app/(tabs)/activity.tsx");
  const tab = read("components/activity/GroupsListTab.tsx");
  const invitations = read("components/activity/GroupInvitations.tsx");
  assert.match(activity, /setRefreshKey\(\(key\) => key \+ 1\)/);
  assert.match(activity, /refreshKey=\{refreshKey\}/);
  assert.match(activity, /finally \{\s*setIsRefreshing\(false\)/);
  assert.match(tab, /<GroupInvitations refreshKey=\{refreshKey\} \/>/);
  assert.match(invitations, /\}, \[load, refreshKey\]\)/);
});

// ---- G: first-run empty states with one action ------------------------------

test("Home's empty state offers one action: share the @handle", () => {
  const list = read("components/homeScreen/ActivityList.tsx");
  const home = read("app/(tabs)/index.tsx");
  assert.match(list, /Nothing here yet/);
  assert.match(list, /Share your @handle so friends can pay you\./);
  assert.match(list, /Share my @handle/);
  assert.match(list, /onPress=\{onReceive\}/);
  assert.match(home, /onReceive=\{\(\) => setShareModalOpen\(true\)\}\s*\/>/);
});

test("Transactions' empty state opens Send, Contacts' has text only", () => {
  const transactions = read("components/activity/TransactionsTab.tsx");
  const contacts = read("components/activity/ContactsTab.tsx");
  assert.match(transactions, /Your payments will show up here\./);
  assert.match(transactions, /router\.push\("\/send"\)/);
  assert.match(transactions, />Send money</);
  assert.match(contacts, /People you pay or get paid by will show up here\./);
  assert.doesNotMatch(contacts, /TouchableOpacity|Pressable/);
});

// ---- H: plain labels --------------------------------------------------------

test("labels read Receive, Send and Balance", () => {
  const header = read("components/Header.tsx");
  assert.match(header, /Receive\s*<\/Text>/);
  assert.match(header, /Send\s*<\/Text>/);
  assert.doesNotMatch(header, /RCV|SEND/);
  for (const file of ["components/homeScreen/BalanceRevealSection.tsx", "components/homeScreen/BalanceSkeleton.tsx"]) {
    const source = read(file);
    assert.match(source, />\s*Balance\s*</);
    assert.doesNotMatch(source, /Liquidity/);
  }
});

// ---- I: center Pay button and Groups tab ------------------------------------

test("the bar is Home, Activity, Pay, Groups, Profile, and unchanged when Vault is on", () => {
  const { tabBarItems } = load("utils/tabBarConfig.ts");
  assert.deepEqual(tabBarItems(false), ["home", "activity", "pay", "groups", "profile"]);
  assert.deepEqual(tabBarItems(true), ["home", "activity", "vaults", "profile"]);
  // Home stays far left and Profile far right.
  for (const flag of [false, true]) {
    const items = tabBarItems(flag);
    assert.equal(items[0], "home");
    assert.equal(items[items.length - 1], "profile");
  }
});

test("Pay is a button that only opens the existing Send screen", () => {
  const nav = read("components/BottomNav.tsx");
  assert.match(nav, /Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Medium\);\s*router\.push\("\/send"\)/);
  assert.match(nav, /accessibilityLabel="Pay"/);
  // It is not a route: no tab file or screen is named pay.
  assert.equal(fs.existsSync(path.join(__dirname, "..", "app", "(tabs)", "pay.tsx")), false);
  assert.doesNotMatch(nav, /route: "pay"/);
});

test("the Groups tab is registered, hidden when Vault is on, and refreshes groups and invitations", () => {
  const layout = read("app/(tabs)/_layout.tsx");
  const groups = read("app/(tabs)/groups.tsx");
  assert.match(layout, /name="groups"[\s\S]*href: VAULTS_ENABLED \? null : "\/groups"/);
  assert.match(groups, /router\.push\("\/group-create"\)/);
  assert.match(groups, /<GroupsListTab/);
  assert.match(groups, /refreshKey=\{refreshKey\}/);
  assert.match(groups, /refreshControl=\{\s*<RefreshControl/);
  assert.match(groups, /finally \{\s*setIsRefreshing\(false\)/);
  // Activity keeps its own Groups sub-tab for now.
  assert.match(read("app/(tabs)/activity.tsx"), /activityTab === "groups"/);
});
