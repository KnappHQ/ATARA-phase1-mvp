const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => {
    if (name in mocks) return mocks[name];
    throw Error(`Missing mock: ${name}`);
  }, exports);
  return exports;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const { withTimeout } = load('utils/asyncOperation.ts');
const { waitForExternalConnection } = load('utils/externalWalletConnection.ts');

function authStoreHarness(storage = {}, userService = {}) {
  const values = new Map();
  const { create } = require('zustand');
  const { useAuthStore } = load('stores/useAuthStore.ts', {
    'expo-secure-store': {
      getItemAsync: async key => values.get(key) ?? null,
      setItemAsync: async (key, value) => { values.set(key, value); },
      deleteItemAsync: async key => { values.delete(key); },
      ...storage,
    },
    zustand: { create },
    'jwt-decode': { jwtDecode: () => ({ exp: Date.now() / 1000 + 3600 }) },
    './useWalletStore': { useWalletStore: { getState: () => ({ setWalletAddress() {}, reset() {} }) } },
    '@/services/user.service': { UserService: userService },
    '@/utils/accountScope': load('utils/accountScope.ts'),
    '@sentry/react-native': { setUser() {}, captureException() {} },
  });
  return { store: useAuthStore, values };
}

test('a delayed startup session cannot restore the previous account after logout', async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const profile = { id: 'old', handle: 'old', smartAccountAddress: '0x123' };
  const { store } = authStoreHarness({ getItemAsync: async key => {
    if (key === 'auth_token') { await blocked; return 'old-token'; }
    return key === 'user_profile' ? JSON.stringify(profile) : null;
  } });
  const restore = store.getState().loadSession();
  await store.getState().logout();
  release(); await restore;
  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().user, null);
  assert.equal(store.getState().justLoggedOut, true);
});

test('a late profile response cannot overwrite the next account in memory or secure storage', async () => {
  let release;
  const response = new Promise(resolve => { release = resolve; });
  const { store, values } = authStoreHarness({}, { updateProfile: () => response });
  await store.getState().setAuth({ id: 'old', handle: 'old', smartAccountAddress: '0x1' }, 'old-token');
  const pending = store.getState().updateProfile({ displayName: 'Old name' });
  const rejected = assert.rejects(pending, /cancelled/);
  await store.getState().logout();
  await store.getState().setAuth({ id: 'new', handle: 'new', smartAccountAddress: '0x2' }, 'new-token');
  release({ displayName: 'Old name' }); await rejected;
  assert.equal(store.getState().user.id, 'new');
  assert.equal(JSON.parse(values.get('user_profile')).id, 'new');
  assert.equal(values.get('auth_token'), 'new-token');
});

test('SDK calls are bounded, preserve errors and allow late settlement without an unhandled rejection', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 100), 7);
  await assert.rejects(withTimeout(Promise.reject(Error('denied')), 100), /denied/);
  let reject;
  const late = new Promise((_, fail) => { reject = fail; });
  await assert.rejects(withTimeout(late, 5), /trop de temps/);
  reject(Error('late')); await pause(1);
});

test('opening the Reown modal alone does not complete login; connected provider is required', async () => {
  let state = { isOpen: true, isConnected: false, hasProvider: false };
  let complete = false;
  const pending = waitForExternalConnection(() => state, new AbortController().signal, 100, 1).then(() => { complete = true; });
  await pause(2); assert.equal(complete, false);
  state = { isOpen: false, isConnected: true, hasProvider: false };
  await pause(2); assert.equal(complete, false);
  state.hasProvider = true;
  await pending; assert.equal(complete, true);
});

test('wallet cancellation, silent startup and disconnect never hang indefinitely', async () => {
  let open = true;
  const pending = waitForExternalConnection(() => ({ isOpen: open, isConnected: false, hasProvider: false }), new AbortController().signal, 100, 1);
  open = false;
  await assert.rejects(pending, /annulée/);
  await assert.rejects(waitForExternalConnection(() => ({ isOpen: false }), new AbortController().signal, 5, 1), /pas répondu/);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(waitForExternalConnection(() => ({ isConnected: true, hasProvider: true }), aborted.signal), /annulée/);
});

test('AASA diagnostic rejects a different Apple app rather than accepting any non-empty list', async () => {
  const savedFetch = global.fetch;
  const { probeDomainAssociation, describeAuthFailure } = load('utils/authDiagnostics.ts');
  try {
    global.fetch = async (_url, options) => {
      assert.equal(options.redirect, 'error');
      return { ok: true, json: async () => ({ webcredentials: { apps: ['WRONG.com.other'] } }) };
    };
    assert.equal((await probeDomainAssociation('api.atara.finance')).layer, 'api');
    global.fetch = async () => ({ ok: true, json: async () => ({ webcredentials: { apps: ['8UTUKDR95M.com.atara.app'] } }) });
    assert.equal(await probeDomainAssociation('api.atara.finance'), undefined);
    global.fetch = async () => { throw Error('offline'); };
    assert.equal(await probeDomainAssociation('api.atara.finance'), undefined);
    assert.match(describeAuthFailure(Error('Already logged in'), { method: 'passkey' }).message, /session/);
  } finally { global.fetch = savedFetch; }
});

function securityHarness(options = {}) {
  let cursor = 0;
  const slots = [];
  const events = [];
  const jsx = (type, props) => ({ type, props });
  const react = {
    useEffect: () => {},
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState: initial => {
      const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
  };
  const native = Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'TextInput', 'ActivityIndicator'].map(name => [name, name]));
  const user = options.external ? null : { id: 'user', linked_accounts: [], mfa_methods: [] };
  const { default: Screen } = load('app/security.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ...native, Linking: { openURL: async () => events.push('open-authenticator') } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useRouter: () => ({ back: () => events.push('back') }) },
    'lucide-react-native': {},
    '@privy-io/expo': {
      usePrivy: () => ({ user, isReady: true }),
      useEmbeddedEthereumWallet: () => ({ wallets: user ? [{}] : [] }),
      useLinkSMS: () => ({}),
      useMfaEnrollment: () => ({
        initMfaEnrollment: async args => {
          assert.equal(args.method, 'totp'); events.push('init');
          return options.init ? options.init() : { authUrl: 'otpauth://totp/ATARA?secret=TESTONLY' };
        },
        submitMfaEnrollment: async args => { assert.deepEqual(args, { method: 'totp', code: '123456' }); events.push('submit'); },
      }),
    },
    '@privy-io/expo/passkey': { useLinkWithPasskey: () => ({ linkWithPasskey: async () => { events.push('link-passkey'); return { linked_accounts: [{ type: 'passkey' }] }; } }) },
    '@/utils/constants': { COLORS: { accent: '#abc' } },
    '@/stores/useAuthStore': { useAuthStore: selector => selector({ user: { authProvider: options.external ? 'external_wallet' : 'apple' } }) },
    '@/providers/AuthProvider': { useAuth: () => ({ logout: async () => events.push('logout') }) },
    '@/providers/ExternalWalletProvider': { useExternalWallet: () => ({}) },
    '@/services/auth.service': { AuthService: { logoutAll: async () => { events.push('revoke'); if (options.revokeError) throw Error('offline'); } } },
    '@/utils/asyncOperation': { withTimeout: task => withTimeout(task, options.timeout ?? 100) },
    '@/utils/exclusiveOperation': load('utils/exclusiveOperation.ts'),
    '@/utils/authDiagnostics': load('utils/authDiagnostics.ts'),
  });
  const render = () => { cursor = 0; return Screen(); };
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const find = predicate => nodes(render()).find(predicate);
  const button = label => find(node => node.props?.label === label);
  return { events, render, nodes, find, button };
}

test('MFA stays inline, requires six digits and only reports activation after server confirmation', async () => {
  const h = securityHarness();
  await h.button('Configurer le second facteur').props.onPress();
  assert.deepEqual(h.events, ['init']);
  assert.equal(h.button('Activer le second facteur').props.disabled, true);
  h.find(node => node.props?.accessibilityLabel === 'Code de l’authentificateur').props.onChangeText('123456');
  assert.equal(h.button('Activer le second facteur').props.disabled, false);
  await h.button('Activer le second facteur').props.onPress();
  assert.deepEqual(h.events, ['init', 'submit']);
  assert.equal(h.button('Second facteur activé').props.disabled, true);
  assert.equal(h.button('Activer le second facteur'), undefined);
});

test('cancel ignores a late MFA configuration and wipes the displayed secret', async () => {
  let finish;
  const h = securityHarness({ init: () => new Promise(resolve => { finish = resolve; }) });
  const pending = h.button('Configurer le second facteur').props.onPress();
  h.find(node => node.type === 'Pressable' && h.nodes(node).some(child => child.props?.children === 'Annuler')).props.onPress();
  finish({ authUrl: 'otpauth://totp/ATARA?secret=TESTONLY' });
  await pending;
  assert.equal(h.button('Activer le second facteur'), undefined);
  assert.ok(h.button('Configurer le second facteur'));
});

test('slow MFA displays a timeout instead of a permanent spinner', async () => {
  const h = securityHarness({ init: () => new Promise(() => {}), timeout: 5 });
  await h.button('Configurer le second facteur').props.onPress();
  assert.match(h.find(node => node.props?.accessibilityRole === 'alert').props.children, /trop de temps/);
  assert.equal(h.find(node => node.type === 'ActivityIndicator'), undefined);
});

test('wallet-only users cannot enroll MFA for an unrelated Privy wallet', () => {
  assert.equal(securityHarness({ external: true }).button('Configurer le second facteur').props.disabled, true);
});

test('revoking sessions closes Privy/Reown even when server revocation fails', async () => {
  const h = securityHarness({ revokeError: true });
  await h.button('Révoquer toutes les sessions ATARA').props.onPress();
  assert.deepEqual(h.events, ['revoke', 'logout']);
});

test('Weekly Flow is absent and logout/change account are discoverable before deletion', () => {
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8'), /WeeklyInsights/);
  const profile = fs.readFileSync(path.join(__dirname, '../app/(tabs)/profile.tsx'), 'utf8');
  assert.match(profile, /label="Se déconnecter"/);
  assert.match(profile, /label="Utiliser un autre compte"/);
});

test('account switching clears private cached contacts and rejects their late responses', async () => {
  const scope = load('utils/accountScope.ts');
  let state;
  let finish;
  const { useContactStore } = load('stores/useContactStore.ts', {
    zustand: { create: initializer => {
      const set = update => { state = { ...state, ...update }; };
      state = initializer(set, () => state);
      return { getState: () => state, setState: set };
    } },
    '@sentry/react-native': { captureException: () => {} },
    '@/utils/format': {},
    '@/utils/accountScope': scope,
    '@/services/contact.service': { ContactService: { getRecentContacts: () => new Promise(resolve => { finish = resolve; }) } },
  });
  useContactStore.setState({ favoriteContacts: [{ id: 'private' }], recentContacts: [{ id: 'old' }] });
  const pending = useContactStore.getState().getRecentContacts();
  scope.resetAccountScope();
  assert.deepEqual(useContactStore.getState().favoriteContacts, []);
  finish([{ id: 'late-old-account' }]); await pending;
  assert.deepEqual(useContactStore.getState().recentContacts, []);
  assert.equal(useContactStore.getState().isLoadingRecents, false);
});
