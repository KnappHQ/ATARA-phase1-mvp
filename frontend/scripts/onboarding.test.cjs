const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the production TypeScript with mocked native/SDK boundaries.
// This is a logic simulation, not an iOS device or a live wallet signature.
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', code)((name) => {
    if (name in mocks) return mocks[name];
    throw new Error(`Missing mock: ${name}`);
  }, exports);
  return exports;
}
const readiness = load('utils/walletReadiness.ts');
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const wallet = { address: '0xAbC', getProvider: async () => ({ request: async () => 'signed' }) };

test('waits for a NEW hook array, matching address case-insensitively', async () => {
  let wallets = [];
  const waiting = readiness.waitForWallet(() => wallets, '0xabc', new AbortController().signal, 200, 1);
  wallets = [wallet];
  assert.equal(await waiting, wallet);
});
test('does not select a different wallet and times out instead of hanging', async () => {
  await assert.rejects(readiness.waitForWallet(() => [wallet], '0xother', new AbortController().signal, 5, 1), /taking too long/);
});
test('return cancels wallet readiness even if the wallet arrives afterward', async () => {
  const controller = new AbortController();
  let wallets = [];
  const waiting = readiness.waitForWallet(() => wallets, wallet.address, controller.signal, 200, 1);
  controller.abort(); wallets = [wallet];
  await assert.rejects(waiting, /cancelled/);
});

function harness() {
  let cursor = 0;
  const slots = [];
  const events = [];
  let sdkWallets = [];
  const user = { id: 'test-user', linked_accounts: [] };
  const updatedUser = { ...user, address: wallet.address };
  let releaseCreate;
  const createResult = new Promise(resolve => { releaseCreate = () => resolve({ user: updatedUser }); });
  const jsx = (type, props) => ({ type, props });
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => null,
    useEffect: () => {},
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useRef: value => {
      const index = cursor++;
      return slots[index] ??= { current: value };
    },
    useState: value => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
  };
  const store = { justLoggedOut: false, logout: async () => events.push('logout'), clearJustLoggedOut: async () => {} };
  const useAuthStore = () => ({ isAuthenticated: false, isLoading: false });
  useAuthStore.getState = () => store;
  const AuthService = {
    requestChallenge: async () => { events.push('challenge'); return { message: 'nonce' }; },
    register: async (params, signal) => { readiness.assertActive(signal); events.push('register'); assert.equal(params.signerAddress, wallet.address); },
  };
  const { AuthProvider } = load('providers/AuthProvider.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@privy-io/expo': {
      usePrivy: () => ({ user, isReady: true, logout: async () => {} }),
      useEmbeddedEthereumWallet: () => ({ wallets: sdkWallets, create: async () => { events.push('create'); return createResult; } }),
      useLoginWithOAuth: () => ({ login: async () => {}, state: { status: 'idle' } }),
    },
    '@privy-io/expo/passkey': { useLoginWithPasskey: () => ({}), useSignupWithPasskey: () => ({}) },
    'expo-haptics': { impactAsync: async () => {}, ImpactFeedbackStyle: {} },
    '@/services/settlementRecovery.service': {}, '@/services/api': {},
    '@/services/auth.service': { AuthService }, '@/utils/walletReadiness': readiness,
    '@/services/smartAccount.service': { createAlchemySmartAccountService: async ({ wallet: signer }) => {
      assert.equal(signer, wallet); events.push('alchemy'); return { getSmartAccountAddress: () => '0xSmart' };
    } },
    '@/providers/ExternalWalletProvider': { useExternalWallet: () => ({ enabled: true, disconnect: async () => {} }) },
    '@/utils/authDiagnostics': {}, '@/stores/useAlertStore': {}, '@/stores/useAuthStore': { useAuthStore },
    '@/utils/privy': { getPrimaryEmbeddedEthereumWalletAddress: u => u?.address, getPrimaryEmailAddress: () => null, getPrimaryOAuthProvider: () => null },
  });
  const render = () => { cursor = 0; return AuthProvider({ children: null }).props.value; };
  return { render, events, releaseCreate, publishWallet: () => { sdkWallets = [wallet]; render(); } };
}

test('passkey registration resumes after create() publishes its wallet; double taps create once', async () => {
  const h = harness(); const auth = h.render();
  const pending = auth.registerWithHandle({ handle: 'tester' });
  await auth.registerWithHandle({ handle: 'tester' });
  h.releaseCreate();
  await pause(5);
  assert.deepEqual(h.events, ['create']);
  h.publishWallet();
  await pending;
  assert.deepEqual(h.events, ['create', 'alchemy', 'challenge', 'register']);
});

test('Back during creation prevents Alchemy, challenge and registration after late completion', async () => {
  const h = harness(); const auth = h.render();
  const pending = auth.registerWithHandle({ handle: 'tester' });
  await auth.logout();
  h.releaseCreate(); h.publishWallet();
  await assert.rejects(pending, /cancelled/);
  assert.deepEqual(h.events, ['create', 'logout']);
  assert.equal(h.render().onboardingStep, 'gate');
});

test('cancelled registration response never commits a local session', async () => {
  const controller = new AbortController(); let saved = false;
  const { AuthService } = load('services/auth.service.ts', {
    '../utils/walletReadiness': readiness,
    '../stores/useAuthStore': { useAuthStore: { getState: () => ({ setAuth: async () => { saved = true; } }) } },
    './api': { api: { post: async () => { controller.abort(); return { data: { user: {}, token: 'test' } }; } } },
  });
  await assert.rejects(AuthService.register({}, controller.signal), /cancelled/);
  assert.equal(saved, false);
});

test('Back stays in safe-area flow, with a 48pt touch target and outside keyboard scroll', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/onboarding/IdentityScreen.tsx'), 'utf8');
  assert.doesNotMatch(source, /absolute left-5 top-4/);
  assert.match(source, /minHeight: 48/);
  assert.match(source, /disabled=\{isGoingBack\}/);
  assert.match(source, /keyboardShouldPersistTaps="handled"/);
  assert.ok(source.indexOf('onPress={handleBack}') < source.indexOf('<KeyboardAvoidingView'));
});
