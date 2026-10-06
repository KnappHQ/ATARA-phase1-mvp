const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the production TypeScript with mocked native/SDK boundaries.
// This is a logic simulation, not an iOS device or a live wallet signature.
function load(file, mocks = {}) {
  // fileName matters: in a .ts file `<T>(x) =>` is a generic arrow, in a .tsx it would be JSX.
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    fileName: file,
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
const accountLabels = load('utils/accountLabels.ts');
const passkeyOptions = load('utils/passkeyOptions.ts', { './accountLabels': accountLabels });
const accountRegistry = load('utils/accountRegistry.ts', { './accountLabels': accountLabels, './passkeyOptions': passkeyOptions });
const loginMethods = load('utils/loginMethods.ts', { './passkeyOptions': passkeyOptions });
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

function harness(options = {}) {
  let cursor = 0;
  const slots = [];
  const events = [];
  // Passkey boundary: what Privy's server would answer and what iOS would do.
  const passkeyLog = { created: [], asserted: [] };
  const privyClient = { auth: { passkey: {
    generateSignupOptions: async () => ({ options: {
      challenge: 'chal', rp: { id: 'api.atara.finance', name: 'ATARA' }, pub_key_cred_params: [{ type: 'public-key', alg: -7 }],
      user: { id: 'handle-1', name: 'ATARA', display_name: 'ATARA' }, authenticator_selection: { resident_key: 'required' },
    } }),
    generateAuthenticationOptions: async () => ({ options: { challenge: 'chal2', rp_id: 'api.atara.finance', user_verification: 'required' } }),
    signupWithPasskey: async () => {
      if (options.linkError) throw new Error('Signup failed');
      return { user: { id: 'privy-new', linked_accounts: [] } };
    },
    loginWithPasskey: async () => ({ user: { id: 'privy-known', linked_accounts: [{ type: 'passkey', credential_id: 'cred-known' }] } }),
    linkWithPasskey: async () => ({ user: {} }),
  } } };
  const nativePasskeys = {
    create: async request => {
      assert.equal(user, null);
      passkeyLog.created.push(request);
      events.push(`passkey-signup:${request.user.name}`);
      return { id: 'cred-new', type: 'public-key' };
    },
    get: async request => { passkeyLog.asserted.push(request); events.push('passkey-targeted'); return { id: request.allowCredentials?.[0]?.id ?? 'cred-any', type: 'public-key' }; },
  };
  const registryAccounts = options.accounts ?? [];
  const registryFake = {
    get accounts() { return registryAccounts; },
    beginPending: async input => { events.push(`registry-pending:${input.label}`); passkeyLog.pending = input; },
    recordSignIn: async input => { events.push('registry-signin'); passkeyLog.signIn = input; },
    removePasskey: async (key, id) => { events.push(`registry-drop:${key}:${id}`); },
    find: () => options.landed,
  };
  const intentStore = { intent: options.intent ?? null, clear() {} };
  let sdkWallets = [];
  let user = { id: 'test-user', linked_accounts: [] };
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
      usePrivy: () => ({ user, isReady: true, logout: async () => {
        events.push('privy-logout');
        if (options.logoutError) throw new Error('provider unavailable');
        user = null;
      } }),
      useEmbeddedEthereumWallet: () => ({ wallets: sdkWallets, create: async () => { events.push('create'); return createResult; } }),
      useLoginWithOAuth: () => ({ login: async () => {}, state: { status: 'idle' } }),
      usePrivyClient: () => privyClient,
    },
    '@privy-io/expo/passkey': {
      useLoginWithPasskey: () => ({ loginWithPasskey: async () => {
        assert.equal(user, null); events.push('passkey-login');
        return options.singlePasskey ? { id: 'privy-known', linked_accounts: [{ type: 'passkey', credential_id: 'cred-known' }] } : undefined;
      } }),
    },
    '@/services/passkey.service': load('services/passkey.service.ts', {
      '../utils/passkeyOptions': passkeyOptions,
    }),
    '@/services/passkeyRuntime': {
      createPasskeyDeps: () => ({ client: privyClient, passkeys: nativePasskeys, randomBytes: n => new Uint8Array(n).fill(9) }),
      randomBytes: n => new Uint8Array(n).fill(9),
    },
    '@/services/accountActions': { checkLanding: () => ({ matched: true }) },
    '@/utils/accountLabels': accountLabels,
    '@/utils/accountRegistry': accountRegistry,
    '@/utils/loginMethods': loginMethods,
    '@/utils/privyConfig': load('utils/privyConfig.ts'),
    '@/stores/useAccountRegistryStore': {
      useAccountRegistryStore: { getState: () => registryFake },
      registryReady: async () => {},
    },
    '@/stores/useAccountSwitchStore': { useAccountSwitchStore: { getState: () => intentStore } },
    'expo-haptics': { impactAsync: async () => {}, ImpactFeedbackStyle: {} },
    '@/services/settlementRecovery.service': {}, '@/services/api': {},
    '@/services/paymentOperations.runtime': { flushRecordings: async () => ({ recorded: 0, waiting: 0, rejected: 0, recordedIds: {} }) },
    '@/stores/useTransactionHistoryStore': { useTransactionHistoryStore: { getState: () => ({ fetchHistory: async () => {} }) } },
    '@/services/auth.service': { AuthService }, '@/utils/walletReadiness': readiness,
    '@/utils/asyncOperation': load('utils/asyncOperation.ts'),
    viem: { stringToHex: value => '0x' + Buffer.from(value).toString('hex') },
    '@/services/smartAccount.service': { createAlchemySmartAccountService: async ({ wallet: signer }) => {
      assert.equal(signer, wallet); events.push('alchemy'); return { getSmartAccountAddress: () => '0xSmart' };
    } },
    '@/providers/ExternalWalletProvider': { useExternalWallet: () => ({ enabled: true, disconnect: async () => { events.push('wallet-disconnect'); }, connect: async () => { events.push('wallet-connect'); } }) },
    '@/utils/authDiagnostics': load('utils/authDiagnostics.ts'), '@/stores/useAlertStore': {}, '@/stores/useAuthStore': { useAuthStore },
    '@/utils/privy': { getPrimaryEmbeddedEthereumWalletAddress: u => u?.address, getPrimaryEmailAddress: () => null, getPrimaryOAuthProvider: () => null },
  });
  const render = () => { cursor = 0; return AuthProvider({ children: null }).props.value; };
  return { render, events, passkeyLog, releaseCreate, publishWallet: () => { sdkWallets = [wallet]; render(); } };
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

function withPasskeyDomain(run) {
  const previous = process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
  process.env.EXPO_PUBLIC_PASSKEY_RP_ID = 'api.atara.finance';
  const restore = () => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
    else process.env.EXPO_PUBLIC_PASSKEY_RP_ID = previous;
  };
  return Promise.resolve().then(run).finally(restore);
}

test('fresh passkey signup closes the old provider session first, names the passkey and coalesces double taps', () => withPasskeyDomain(async () => {
  const h = harness(); const auth = h.render();
  await Promise.all([
    auth.startPasskey('signup', { label: 'Tanguy — Tests' }),
    auth.startPasskey('signup', { label: 'Tanguy — Tests' }),
  ]);
  assert.deepEqual(h.events, ['privy-logout', 'wallet-disconnect', 'passkey-signup:Tanguy — Tests', 'registry-pending:Tanguy — Tests']);
  // The passkey iOS stores carries the person's name, not Privy's constant one,
  // while everything that identifies the credential is what Privy sent.
  const request = h.passkeyLog.created[0];
  assert.equal(request.user.name, 'Tanguy — Tests');
  assert.equal(request.user.displayName, 'Tanguy — Tests');
  assert.equal(request.user.id, 'handle-1');
  assert.equal(request.challenge, 'chal');
  assert.equal(request.rp.id, 'api.atara.finance');
  // The new account is remembered by its Privy user id and credential id.
  assert.equal(h.passkeyLog.pending.privyUserId, 'privy-new');
  assert.equal(h.passkeyLog.pending.credentialId, 'cred-new');
  assert.equal(h.render().oauthError, null);
}));

test('signup without a chosen name still gets a distinctive one, never the shared "ATARA"', () => withPasskeyDomain(async () => {
  const h = harness(); await h.render().startPasskey('signup');
  const name = h.passkeyLog.created[0].user.name;
  assert.match(name, /^Account [A-Z2-9]{4}$/);
  assert.notEqual(name, 'ATARA');
}));

test('a name already used by another account on this iPhone is refused before any passkey exists', () => withPasskeyDomain(async () => {
  const h = harness({ accounts: [{ key: 'a', label: 'Tanguy — Tests', passkeys: [] }] });
  await h.render().startPasskey('signup', { label: 'tanguy — tests' });
  assert.equal(h.passkeyLog.created.length, 0);
  assert.match(h.render().oauthError, /already has this name/);
  // A refused name is not a sign-in fault: no advice about Privy or the API.
  assert.doesNotMatch(h.render().oauthError, /Privy|Reown|API/);
}));

test('a passkey created but not accepted by Privy is reported by name, so it can be deleted', () => withPasskeyDomain(async () => {
  const h = harness({ linkError: true });
  await h.render().startPasskey('signup', { label: 'Tanguy — Perso' });
  assert.match(h.render().oauthError, /“Tanguy — Perso” was created on this iPhone but linked to no account/);
  assert.equal(h.events.includes('registry-pending:Tanguy — Perso'), false);
}));

test('signing in to a known account offers that one credential only and records which one worked', () => withPasskeyDomain(async () => {
  const h = harness(); await h.render().startPasskey('login', { credentialId: 'cred-known' });
  assert.deepEqual(h.passkeyLog.asserted[0].allowCredentials, [{ id: 'cred-known', type: 'public-key' }]);
  assert.equal(h.passkeyLog.signIn.privyUserId, 'privy-known');
  assert.equal(h.passkeyLog.signIn.usedCredentialId, 'cred-known');
}));

test('a switch answered by a credential Privy files under another account corrects the list', () => withPasskeyDomain(async () => {
  const h = harness({
    intent: { kind: 'switch', target: { accountKey: 'expected', plan: { method: 'passkey', credentialId: 'cred-known' } } },
    landed: { key: 'someone-else' },
  });
  await h.render().startPasskey('login', { credentialId: 'cred-known' });
  assert.ok(h.events.includes('registry-drop:expected:cred-known'));
}));

test('the generic picker keeps working, and a single passkey is remembered as the one that worked', () => withPasskeyDomain(async () => {
  const h = harness({ singlePasskey: true }); await h.render().startPasskey('login');
  assert.deepEqual(h.events.slice(0, 3), ['privy-logout', 'wallet-disconnect', 'passkey-login']);
  assert.equal(h.passkeyLog.signIn.usedCredentialId, 'cred-known');
  assert.equal(h.passkeyLog.asserted.length, 0);
}));

test('failed provider logout blocks switching rather than linking to the previous account', async () => {
  const h = harness({ logoutError: true });
  await h.render().startExternalWallet();
  assert.equal(h.events.includes('wallet-connect'), false);
  assert.ok(h.render().oauthError);
});

test('external wallet sign-in clears the existing Privy session before opening Reown', async () => {
  const h = harness();
  await h.render().startExternalWallet();
  assert.deepEqual(h.events, ['privy-logout', 'wallet-disconnect', 'wallet-connect']);
});

test('Back during creation prevents Alchemy, challenge and registration after late completion', async () => {
  const h = harness(); const auth = h.render();
  const pending = auth.registerWithHandle({ handle: 'tester' });
  await auth.logout();
  h.releaseCreate(); h.publishWallet();
  await assert.rejects(pending, /cancelled/);
  assert.deepEqual(h.events, ['create', 'logout', 'privy-logout', 'wallet-disconnect']);
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

test('new account name is saved through the current profile API after signup', async () => {
  const events = [];
  const { AuthService } = load('services/auth.service.ts', {
    '../utils/walletReadiness': readiness,
    '../stores/useAuthStore': { useAuthStore: { getState: () => ({
      setAuth: async () => events.push('registered'),
      updateProfile: async ({ displayName }) => events.push(`named:${displayName}`),
    }) } },
    './api': { api: { post: async () => ({ data: { user: { id: 'new' }, token: 'token' } }) } },
  });
  await AuthService.register({ handle: 'test', displayName: 'Personnel' });
  assert.deepEqual(events, ['registered', 'named:Personnel']);
});

test('profile name failure does not turn a successful signup into a second signup', async () => {
  const { AuthService } = load('services/auth.service.ts', {
    '../utils/walletReadiness': readiness,
    '../stores/useAuthStore': { useAuthStore: { getState: () => ({
      setAuth: async () => {},
      updateProfile: async () => { throw new Error('profile temporarily unavailable'); },
    }) } },
    './api': { api: { post: async () => ({ data: { user: { id: 'new' }, token: 'token' } }) } },
  });
  const previousWarn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(await AuthService.register({ displayName: 'Personnel' }), { id: 'new' });
  } finally {
    console.warn = previousWarn;
  }
});

test('cancelled automatic login never commits a late backend session', async () => {
  const controller = new AbortController();
  let saved = false;
  let requestCount = 0;
  const { AuthService } = load('services/auth.service.ts', {
    '../utils/walletReadiness': readiness,
    '../stores/useAuthStore': { useAuthStore: { getState: () => ({ setAuth: async () => { saved = true; } }) } },
    './api': { api: { post: async (_path, _body, config) => {
      assert.equal(config.signal, controller.signal);
      requestCount++;
      if (requestCount === 1) return { data: { message: 'challenge' } };
      controller.abort();
      return { data: { user: {}, token: 'late-token' } };
    } } },
  });

  await assert.rejects(
    AuthService.loginWithSigner('0xabc', async () => 'signature', controller.signal),
    /cancelled/,
  );
  assert.equal(requestCount, 2);
  assert.equal(saved, false);
});

test('logout-all clears this device even when remote revocation fails', async () => {
  let localLogouts = 0;
  const { AuthService } = load('services/auth.service.ts', {
    '../utils/walletReadiness': readiness,
    '../stores/useAuthStore': { useAuthStore: { getState: () => ({ logout: async () => { localLogouts++; } }) } },
    './api': { api: { post: async () => { throw new Error('offline'); } } },
  });

  await assert.rejects(AuthService.logoutAll(), /offline/);
  assert.equal(localLogouts, 1);
});

test('Back stays in safe-area flow, with a 48pt touch target and outside keyboard scroll', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/onboarding/IdentityScreen.tsx'), 'utf8');
  assert.doesNotMatch(source, /absolute left-5 top-4/);
  assert.match(source, /minHeight: 48/);
  assert.match(source, /disabled=\{isGoingBack\}/);
  assert.match(source, /keyboardShouldPersistTaps="handled"/);
  assert.ok(source.indexOf('onPress={handleBack}') < source.indexOf('<KeyboardAvoidingView'));
});

test('the sign-in gate scrolls on small phones and blocks Privy actions until ready', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/onboarding/GateScreen.tsx'), 'utf8');
  assert.match(source, /<ScrollView/);
  assert.match(source, /contentContainerStyle=\{\{/);
  assert.match(source, /!isPrivyReady/);
  assert.match(source, /Preparing secure sign-in/);
});

test('unstable external wallet login is absent from the beta gate and runtime is opt-in', () => {
  const gate = fs.readFileSync(path.join(__dirname, '../components/onboarding/GateScreen.tsx'), 'utf8');
  const provider = fs.readFileSync(path.join(__dirname, '../providers/ExternalWalletProvider.tsx'), 'utf8');
  assert.doesNotMatch(gate, /Use my existing wallet/);
  assert.doesNotMatch(gate, /onStartExternalWallet/);
  assert.match(provider, /EXPO_PUBLIC_ENABLE_EXTERNAL_WALLET === "true"/);
  assert.match(provider, /if \(!externalWalletEnabled\) return;/);
});

test('funding screen is the receive path and shows the card section only under the flag', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/add-crypto.tsx'), 'utf8');
  const card = fs.readFileSync(path.join(__dirname, '../components/addMoney/CardPurchaseSection.tsx'), 'utf8');
  assert.match(source, /Base Sepolia/);
  assert.match(source, /Clipboard\.setStringAsync\(walletAddress\)/);
  assert.match(source, /Test USDC has no value\. Never send real money here/);
  assert.match(source, /import \{ CARD_PURCHASE_ENABLED \} from "@\/utils\/featureFlags"/);
  assert.match(source, /CARD_PURCHASE_ENABLED \? \(\s*<CardPurchaseSection \/>/);
  // The beta only ever opens the sandbox: the check lives with the flow, and the card section uses it.
  assert.match(card, /await runCheckout\(/);
  assert.match(fs.readFileSync(path.join(__dirname, '../utils/onrampFlow.ts'), 'utf8'), /session\.mode !== undefined && session\.mode !== "sandbox"/);
});

test('concurrent sends on the same wallet are rejected before any network call', async () => {
  const { runExclusiveOperation } = load('utils/exclusiveOperation.ts');
  let finish; let sent = 0;
  const first = runExclusiveOperation('base:wallet', () => {
    sent++;
    return new Promise(resolve => { finish = resolve; });
  });
  await assert.rejects(runExclusiveOperation('base:wallet', async () => { sent++; }), /already in progress/);
  assert.equal(sent, 1);
  finish('receipt');
  assert.equal(await first, 'receipt');
  assert.equal(await runExclusiveOperation('base:wallet', async () => 'next'), 'next');
});

test('operation lock releases on failure and does not block a different wallet', async () => {
  const { runExclusiveOperation } = load('utils/exclusiveOperation.ts');
  await assert.rejects(runExclusiveOperation('a', async () => { throw new Error('rejected'); }), /rejected/);
  await runExclusiveOperation('a', async () => runExclusiveOperation('b', async () => 'ok'));
});

function walletStoreHarness() {
  let state; const requests = []; const chainReads = [];
  const walletBalance = load('utils/walletBalance.ts', { './paymentRequest': load('utils/paymentRequest.ts') });
  const { useWalletStore } = load('stores/useWalletStore.ts', {
    zustand: { create: initializer => {
      state = initializer(update => { state = { ...state, ...update }; }, () => state);
      return { getState: () => state };
    } },
    '@sentry/react-native': { captureException: () => {} },
    '@/utils/constants': { DEFAULT_ASSETS: [{ symbol: 'ETH', balance: '0', usdValue: '$0', usdPrice: 0 }], CHAIN_ID: 84532, NETWORK_NAME: 'Base Sepolia' },
    '@/services/wallet.service': { WalletService: { getPortfolio: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) } },
    '@/utils/chainBalance': { readOnChainBalances: (owner) => new Promise((resolve, reject) => chainReads.push({ owner, resolve, reject })) },
    '@/utils/walletBalance': walletBalance,
  });
  const portfolio = (amount) => ({ totalUSD: amount, change24h: 0, percentChange24h: 0, tokens: [{ symbol: 'ETH', balance: String(amount), usdValue: amount }] });
  return { store: useWalletStore, requests, chainReads, portfolio };
}

const oneEth = [{ symbol: 'ETH', balanceWei: '1000000000000000000', decimals: 18 }];

test('when the portfolio service fails, balances come from the chain instead of zeros', async () => {
  const h = walletStoreHarness();
  h.store.getState().setWalletAddress('0xA');
  const run = h.store.getState().refreshBalances();
  h.requests[0].reject(new Error('service down')); await pause(0);
  assert.equal(h.chainReads[0].owner, '0xA');
  h.chainReads[0].resolve(oneEth); await run;
  assert.equal(h.store.getState().assets[0].balance, '1');
  assert.equal(h.store.getState().balanceSource, 'chain');
  assert.equal(h.store.getState().balanceError, null);
});

test('a late chain read for a previous wallet is ignored', async () => {
  const h = walletStoreHarness();
  h.store.getState().setWalletAddress('0xA');
  const run = h.store.getState().refreshBalances();
  h.requests[0].reject(new Error('service down')); await pause(0);
  h.store.getState().setWalletAddress('0xB');
  h.chainReads[0].resolve(oneEth); await run;
  assert.equal(h.store.getState().assets[0].balance, '0');
  assert.equal(h.store.getState().balanceSource, null);
});

test('when the chain is unreachable too, the balance is reported unavailable, not zero', async () => {
  const h = walletStoreHarness();
  h.store.getState().setWalletAddress('0xA');
  const run = h.store.getState().refreshBalances();
  h.requests[0].reject(new Error('service down')); await pause(0);
  h.chainReads[0].reject(new Error('rpc down')); await run;
  assert.equal(h.store.getState().balanceSource, null);
  assert.match(h.store.getState().balanceError, /unavailable/i);
});

test('switching wallets clears old balances and ignores a late portfolio response', async () => {
  const h = walletStoreHarness();
  h.store.getState().setWalletAddress('0xA');
  const first = h.store.getState().refreshBalances();
  h.store.getState().setWalletAddress('0xB');
  h.requests[0].resolve(h.portfolio(900)); await first;
  assert.equal(h.store.getState().totalUSDValue, 0);
  assert.equal(h.store.getState().smartAccountAddress, '0xB');
});

test('logout/reset discards in-flight data; newer refresh wins over older refresh', async () => {
  const h = walletStoreHarness();
  h.store.getState().setWalletAddress('0xA');
  const first = h.store.getState().refreshBalances();
  const second = h.store.getState().refreshBalances();
  h.requests[1].resolve(h.portfolio(2)); await second;
  h.requests[0].resolve(h.portfolio(1)); await first;
  assert.equal(h.store.getState().totalUSDValue, 2);
  const third = h.store.getState().refreshBalances();
  h.store.getState().reset();
  h.requests[2].resolve(h.portfolio(100)); await third;
  assert.equal(h.store.getState().totalUSDValue, 0);
  assert.equal(h.store.getState().smartAccountAddress, undefined);
});

test('late 401 for an old token and anonymous 401 do not log out the current account', async () => {
  let responseError; let logouts = 0;
  const previous = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'https://example.test';
  try {
    const { registerUnauthorizedHandler } = load('services/api.ts', {
      axios: { default: { create: () => ({ interceptors: { request: { use: () => {} }, response: { use: (_ok, handler) => { responseError = handler; } } } }) } },
      'expo-secure-store': { getItemAsync: async () => 'current-token' },
      '../utils/constants': { API_URL: 'https://example.test/api' },
    });
    registerUnauthorizedHandler(async () => { logouts++; await pause(5); });
    const error = (token) => ({ response: { status: 401 }, config: { headers: { Authorization: token ? `Bearer ${token}` : undefined } } });
    await assert.rejects(responseError(error('old-token')));
    await assert.rejects(responseError(error()));
    assert.equal(logouts, 0);
    await Promise.allSettled([responseError(error('current-token')), responseError(error('current-token'))]);
    assert.equal(logouts, 1);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previous;
  }
});


test('external wallet loading keeps the app root mounted and contains runtime failures', () => {
  const providerSource = fs.readFileSync(path.join(__dirname, '../providers/ExternalWalletProvider.tsx'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(__dirname, '../providers/ReownExternalWalletRuntime.tsx'), 'utf8');
  assert.doesNotMatch(providerSource, /if\s*\(Runtime\)\s*\{\s*return\s*<Runtime/s);
  assert.match(providerSource, /<ExternalWalletContext\.Provider value=\{value\}>/);
  assert.match(providerSource, /<WalletRuntimeBoundary/);
  assert.match(providerSource, /shouldRestoreExternalWalletSession/);
  assert.doesNotMatch(runtimeSource, /autoConnect/);
  assert.match(runtimeSource, /modalContentWrapper=\{WalletModalContent\}/);
  assert.match(runtimeSource, /onValue\(value\)/);
});

test('external wallet restore marker is explicit and reversible', async () => {
  const values = new Map();
  const asyncStorage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
  };
  const session = load('utils/externalWalletSession.ts', {
    '@react-native-async-storage/async-storage': { default: asyncStorage },
  });
  assert.equal(await session.shouldRestoreExternalWalletSession(), false);
  await session.rememberExternalWalletSession();
  assert.equal(await session.shouldRestoreExternalWalletSession(), true);
  await session.forgetExternalWalletSession();
  assert.equal(await session.shouldRestoreExternalWalletSession(), false);
});

test('a valid SecureStore backend session survives a normal app relaunch', async () => {
  const profile = {
    id: 'user-1',
    handle: 'tanguy',
    smartAccountAddress: '0x123',
  };
  const secureValues = new Map([
    ['auth_token', 'valid.jwt.token'],
    ['user_profile', JSON.stringify(profile)],
  ]);
  let state;
  let restoredWalletAddress;
  const create = initializer => {
    const set = update => {
      const next = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...next };
    };
    state = initializer(set, () => state);
    const hook = () => state;
    hook.getState = () => state;
    return hook;
  };
  const { useAuthStore } = load('stores/useAuthStore.ts', {
    'expo-secure-store': {
      getItemAsync: async key => secureValues.get(key) ?? null,
      setItemAsync: async (key, value) => { secureValues.set(key, value); },
      deleteItemAsync: async key => { secureValues.delete(key); },
    },
    'zustand': { create },
    'jwt-decode': {
      jwtDecode: () => ({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    },
    './useWalletStore': {
      useWalletStore: {
        getState: () => ({
          setWalletAddress: address => { restoredWalletAddress = address; },
          reset: () => {},
        }),
      },
    },
    '@/services/user.service': { UserService: {} },
    '@/utils/accountScope': load('utils/accountScope.ts'),
    './useAddressBookStore': { useAddressBookStore: { getState: () => ({ openFor: () => {} }) } },
    '@/utils/userProfile': load('utils/userProfile.ts'),
    '@sentry/react-native': {
      setUser: () => {},
      captureException: () => {},
    },
  });

  await useAuthStore.getState().loadSession();
  assert.equal(useAuthStore.getState().isAuthenticated, true);
  assert.equal(useAuthStore.getState().user.handle, 'tanguy');
  assert.equal(restoredWalletAddress, profile.smartAccountAddress);
});

test('logout wins over a login whose SecureStore write completes late', async () => {
  const values = new Map();
  let releaseTokenWrite;
  let markTokenWriteStarted;
  const tokenWriteStarted = new Promise(resolve => { markTokenWriteStarted = resolve; });
  const tokenWriteBlock = new Promise(resolve => { releaseTokenWrite = resolve; });
  let state;
  const create = initializer => {
    const set = update => {
      const next = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...next };
    };
    state = initializer(set, () => state);
    const hook = () => state;
    hook.getState = () => state;
    return hook;
  };
  const { useAuthStore } = load('stores/useAuthStore.ts', {
    'expo-secure-store': {
      getItemAsync: async key => values.get(key) ?? null,
      setItemAsync: async (key, value) => {
        if (key === 'auth_token') {
          markTokenWriteStarted();
          await tokenWriteBlock;
        }
        values.set(key, value);
      },
      deleteItemAsync: async key => { values.delete(key); },
    },
    'zustand': { create },
    'jwt-decode': { jwtDecode: () => ({ exp: 0 }) },
    './useWalletStore': {
      useWalletStore: { getState: () => ({ setWalletAddress: () => {}, reset: () => {} }) },
    },
    '@/services/user.service': { UserService: {} },
    '@/utils/accountScope': load('utils/accountScope.ts'),
    './useAddressBookStore': { useAddressBookStore: { getState: () => ({ openFor: () => {} }) } },
    '@/utils/userProfile': load('utils/userProfile.ts'),
    '@sentry/react-native': { setUser: () => {}, captureException: () => {} },
  });

  const lateLogin = useAuthStore.getState().setAuth(
    { id: 'late', handle: 'late', smartAccountAddress: '0x123' },
    'late-token',
  );
  await tokenWriteStarted;
  const logout = useAuthStore.getState().logout();
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  releaseTokenWrite();

  await assert.rejects(lateLogin, /cancelled/);
  await logout;
  assert.equal(values.has('auth_token'), false);
  assert.equal(values.has('user_profile'), false);
  assert.equal(useAuthStore.getState().isAuthenticated, false);
});
