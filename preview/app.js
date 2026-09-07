'use strict';

// Local simulation only: no wallet, on-ramp, authentication or blockchain calls.
const state = { balance: 25000, vault: 12500, contribution: 5000 };
let vaultModel = {
  totalWithdrawn: 0,
  name: 'Vault vacances',
  unlock: (() => { const date = new Date(); date.setUTCDate(date.getUTCDate() + 14); date.setUTCHours(12, 0, 0, 0); return date; })(),
  deleted: false,
  members: [
    { handle: '@demo.atara', name: 'Toi', contribution: 5000, accepted: true },
    { handle: '@marcuschen', name: 'Marcus Chen', contribution: 4500, accepted: true },
    { handle: '@elenarodriguez', name: 'Elena Rodriguez', contribution: 3000, accepted: true },
  ],
  deleteApprovals: new Set(),
};
const cryptoAssets = [
  { symbol: 'USDC', name: 'USD Coin', amount: 250, usdValue: 250, decimals: 2 },
  { symbol: 'ETH', name: 'Ethereum', amount: 0.12, usdValue: 360, decimals: 4 },
  { symbol: 'BTC', name: 'Bitcoin', amount: 0.0034, usdValue: 220, decimals: 6 },
  { symbol: 'SOL', name: 'Solana', amount: 1.85, usdValue: 270, decimals: 3 },
  { symbol: 'XMR', name: 'Monero', amount: 0.42, usdValue: 68, decimals: 4 },
];
const routes = new Set(['welcome', 'home', 'add', 'pay', 'vault', 'send', 'activity-screen', 'contact-detail', 'group-detail', 'profile', 'security', 'card']);
const demoContacts = [
  { handle: 'marcuschen', name: 'Marcus Chen' },
  { handle: 'elenarodriguez', name: 'Elena Rodriguez' },
  { handle: 'jameswilson', name: 'James Wilson' },
  { handle: 'demoami', name: 'Demo Ami' },
  { handle: 'democafe', name: 'Demo Café' },
  { handle: 'demomarche', name: 'Demo Marché' },
].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
const contacts = new Set(demoContacts.map(contact => contact.handle));
const securityState = { passkey: false, twofa: false, backupPhone: '' };
const activityContacts = {
  marcus: { name: '@marcuschen', address: '0x71C7…9742', received: 1358, sent: 150, txs: [
    { title: 'Dinner split 🍕', amount: 1038, date: 'Dec 16, 2024 · 2:34 PM', icon: 'arrow-down-left-icon' },
    { title: 'Coffee run ☕', amount: -150, date: 'Dec 15, 2024 · 11:20 AM', icon: 'arrow-up-icon' },
    { title: 'Concert tickets', amount: 320, date: 'Dec 10, 2024 · 3:15 PM', icon: 'arrow-down-left-icon' },
  ] },
  elena: { name: '@elenarodriguez', address: '0xAb58…ecD8', received: 2736.54, sent: 75, txs: [
    { title: 'Rent share', amount: 2736.54, date: 'Dec 14, 2024', icon: 'arrow-down-left-icon' },
    { title: 'Groceries', amount: -75, date: 'Dec 11, 2024', icon: 'arrow-up-icon' },
  ] },
  james: { name: '@jameswilson', address: '0xC02a…6Cc2', received: 0, sent: 500, txs: [
    { title: 'Equipment rental', amount: -500, date: 'Dec 13, 2024', icon: 'arrow-up-icon' },
  ] },
};
const demoGroups = [{ id: 'weekend-paris', name: 'weekend paris', members: ['me', 'marcuschen'], expenses: [], sequence: 0 }];
let selectedGroupId = 'weekend-paris';
const usedDemoReceipts = new Set();
let selectedContact = 'marcus';
let activityTab = 'transactions';
let selectedCryptoIndex = 0;
let selectedPaymentSymbol = 'USDC';
let cryptoSwipeStartX = null;
const formatMoney = cents => (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatAssetAmount = asset => Number(asset.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: asset.decimals });
const formatAssetUsd = asset => Number(asset.usdValue).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCryptoAmount = (amount, asset) => Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: asset.decimals });
const activity = [{ title: 'Solde de démonstration', amount: 25000, icon: 'down-icon', date: 'Début de la simulation' }];
const dialog = document.getElementById('demoDialog');
const receiveDialog = document.getElementById('receiveDialog');

function readAmount(raw) {
  const value = raw.trim().replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 && cents <= 10000000 ? cents : null;
}

function show(id, focus = true) {
  if (!routes.has(id)) id = 'welcome';
  const welcome = id === 'welcome';
  document.getElementById('welcome').hidden = !welcome;
  document.getElementById('wallet').hidden = welcome;
  document.querySelectorAll('.screen').forEach(el => { el.hidden = el.id !== id; });
  const currentTab = id === 'profile' || id === 'security' || id === 'card' ? 'profile' : id === 'activity-screen' || id === 'contact-detail' || id === 'group-detail' ? 'activity-screen' : id === 'vault' ? 'vault' : 'home';
  document.querySelectorAll('.bottom-nav button').forEach(button => {
    if (button.dataset.screen === currentTab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (id === 'contact-detail') renderContactDetail();
  if (id === 'group-detail') renderGroupDetail();
  if (focus) document.querySelector(`#${id} h1`)?.focus({ preventScroll: true });
}

function navigate(id) {
  if (!routes.has(id)) return;
  if (location.hash === '#' + id) show(id);
  else location.hash = id;
}

document.querySelectorAll('[data-screen]').forEach(button => {
  button.addEventListener('click', () => navigate(button.dataset.screen));
});
document.querySelectorAll('[data-auth]').forEach(button => {
  button.addEventListener('click', () => dialog.showModal());
});
document.getElementById('enterDemo').addEventListener('click', () => { dialog.close(); navigate('home'); });
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

document.getElementById('balanceToggle').addEventListener('click', event => {
  const button = event.currentTarget;
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', expanded ? 'Masquer le solde fictif' : 'Afficher le solde fictif');
  document.getElementById('balanceBlock').hidden = !expanded;
});

function currentCrypto() {
  return cryptoAssets[selectedCryptoIndex] || cryptoAssets[0];
}

function renderCryptoCarousel() {
  const asset = currentCrypto();
  const amount = document.querySelector('[data-asset-balance]');
  const symbol = document.querySelector('[data-asset-symbol]');
  const name = document.querySelector('[data-asset-name]');
  const mark = document.querySelector('[data-asset-mark]');
  const usd = document.querySelector('[data-asset-usd]');
  const dots = document.getElementById('cryptoDots');
  if (!amount || !symbol || !name || !mark || !usd || !dots) return;

  if (asset.symbol === 'USDC') {
    asset.amount = state.balance / 100;
    asset.usdValue = state.balance / 100;
  }
  amount.textContent = formatAssetAmount(asset);
  symbol.textContent = asset.symbol;
  name.textContent = asset.name;
  mark.textContent = asset.symbol.slice(0, 2);
  usd.textContent = formatAssetUsd(asset);
  dots.replaceChildren();
  cryptoAssets.forEach((item, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `crypto-dot${index === selectedCryptoIndex ? ' active' : ''}`;
    dot.setAttribute('aria-label', `Afficher ${item.name}`);
    dot.setAttribute('aria-current', String(index === selectedCryptoIndex));
    dot.addEventListener('click', () => selectCrypto(index));
    dots.append(dot);
  });
  document.getElementById('cryptoCarousel')?.setAttribute('aria-label', `${asset.name} sélectionné. Balaye pour changer de crypto.`);
}

function selectCrypto(nextIndex) {
  selectedCryptoIndex = (nextIndex + cryptoAssets.length) % cryptoAssets.length;
  renderCryptoCarousel();
}

function selectedPaymentAsset() {
  return cryptoAssets.find(asset => asset.symbol === selectedPaymentSymbol) || cryptoAssets[0];
}

function demoAssetBalance(asset) {
  return asset.symbol === 'USDC' ? state.balance / 100 : Number(asset.amount);
}

function demoAssetUnitPrice(asset) {
  const balance = Number(asset.amount);
  return balance > 0 ? Number(asset.usdValue) / balance : 0;
}

function demoAssetBalanceLabel(asset) {
  return asset.symbol === 'USDC' ? formatMoney(state.balance) : formatAssetAmount(asset);
}

function renderAssetPicker(id) {
  const picker = document.getElementById(id);
  if (!picker) return;
  picker.replaceChildren();
  cryptoAssets.forEach(asset => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `asset-option${asset.symbol === selectedPaymentSymbol ? ' active' : ''}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(asset.symbol === selectedPaymentSymbol));
    option.addEventListener('click', () => selectPaymentAsset(asset.symbol));
    const symbol = document.createElement('strong');
    symbol.textContent = asset.symbol;
    const balance = document.createElement('span');
    balance.textContent = demoAssetBalanceLabel(asset);
    option.append(symbol, balance);
    picker.append(option);
  });
}

function renderPaymentAssetControls() {
  const asset = selectedPaymentAsset();
  renderAssetPicker('sendAssetPicker');
  renderAssetPicker('payAssetPicker');
  document.querySelectorAll('[data-send-symbol]').forEach(el => { el.textContent = asset.symbol; });
  document.querySelectorAll('[data-pay-symbol]').forEach(el => { el.textContent = asset.symbol; });
  document.querySelectorAll('[data-send-balance]').forEach(el => { el.textContent = demoAssetBalanceLabel(asset); });
  document.querySelectorAll('[data-pay-balance]').forEach(el => { el.textContent = demoAssetBalanceLabel(asset); });
}

function selectPaymentAsset(symbol) {
  if (!cryptoAssets.some(asset => asset.symbol === symbol)) return;
  selectedPaymentSymbol = symbol;
  const sendAmount = document.getElementById('sendAmount');
  const payAmount = document.getElementById('payAmount');
  if (sendAmount) sendAmount.value = '';
  if (payAmount) payAmount.value = '';
  document.getElementById('sendNotice').hidden = true;
  document.getElementById('payNotice').hidden = true;
  renderPaymentAssetControls();
}

function renderContactSuggestions(query) {
  const input = document.getElementById('recipient');
  const list = document.getElementById('contactSuggestions');
  if (!input || !list) return;
  const raw = query.trim().toLocaleLowerCase('fr');
  if (!raw.startsWith('@')) {
    list.hidden = true;
    return;
  }
  const handleQuery = raw.slice(1);
  const matches = demoContacts.filter(contact =>
    !handleQuery || contact.handle.includes(handleQuery) || contact.name.toLocaleLowerCase('fr').includes(handleQuery),
  );
  list.replaceChildren();
  matches.forEach(contact => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'contact-suggestion';
    option.setAttribute('role', 'option');
    option.innerHTML = '<span class="avatar"></span><span class="grow"><strong></strong><span class="sub"></span></span><span aria-hidden="true">›</span>';
    option.querySelector('.avatar').textContent = contact.name.slice(0, 2).toUpperCase();
    option.querySelector('strong').textContent = `@${contact.handle}`;
    option.querySelector('.sub').textContent = contact.name;
    option.addEventListener('click', () => {
      input.value = `@${contact.handle}`;
      input.removeAttribute('aria-invalid');
      list.hidden = true;
    });
    list.append(option);
  });
  list.hidden = matches.length === 0;
}

document.getElementById('recipient')?.addEventListener('input', event => renderContactSuggestions(event.target.value));
document.getElementById('recipient')?.addEventListener('focus', event => renderContactSuggestions(event.target.value));
document.getElementById('recipient')?.addEventListener('blur', () => setTimeout(() => {
  const list = document.getElementById('contactSuggestions');
  if (list) list.hidden = true;
}, 120));

document.querySelectorAll('[data-crypto-direction]').forEach(button => {
  button.addEventListener('click', () => selectCrypto(selectedCryptoIndex + Number(button.dataset.cryptoDirection)));
});
document.getElementById('cryptoCarousel')?.addEventListener('pointerdown', event => {
  cryptoSwipeStartX = event.clientX;
});
document.getElementById('cryptoCarousel')?.addEventListener('pointerup', event => {
  if (cryptoSwipeStartX === null) return;
  const delta = event.clientX - cryptoSwipeStartX;
  cryptoSwipeStartX = null;
  if (Math.abs(delta) >= 42) selectCrypto(selectedCryptoIndex + (delta < 0 ? 1 : -1));
});
document.getElementById('cryptoCarousel')?.addEventListener('pointercancel', () => { cryptoSwipeStartX = null; });
document.getElementById('cryptoCarousel')?.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); selectCrypto(selectedCryptoIndex + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); selectCrypto(selectedCryptoIndex - 1); }
});

document.getElementById('contactSearch').addEventListener('input', event => {
  const query = event.target.value.toLocaleLowerCase('fr').replace(/^@/, '').trim();
  let count = 0;
  document.querySelectorAll('[data-contact]').forEach(button => {
    const match = button.dataset.contact.includes(query) || button.textContent.toLocaleLowerCase('fr').includes(query);
    button.hidden = !match;
    if (match) count++;
  });
  document.getElementById('noContacts').hidden = count !== 0;
});
document.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => {
  document.getElementById('recipient').value = '@' + button.dataset.contact;
  document.getElementById('recipient').removeAttribute('aria-invalid');
  document.getElementById('sendNotice').hidden = true;
  navigate('send');
}));

function formatSigned(amount) {
  return `${amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(Math.round(amount * 100)))} USDC`;
}

function renderContacts(filter = '') {
  const list = document.getElementById('contactList');
  if (!list) return;
  list.replaceChildren();
  Object.entries(activityContacts).sort((a, b) => a[1].name.localeCompare(b[1].name, 'fr')).filter(([, contact]) => !filter || `${contact.name} ${contact.txs.map(tx => tx.title).join(' ')}`.toLowerCase().includes(filter.toLowerCase())).forEach(([id, contact]) => {
    const debt = AtaraLedger.balances(demoGroups, 'me', contact.name.slice(1));
    const row = document.createElement('button');
    row.className = 'contact-thread card';
    row.dataset.contactDetail = id;
    row.innerHTML = `<span class="avatar">${contact.name.slice(1, 3).toUpperCase()}</span><span class="grow"><strong></strong><span class="sub"></span><span class="sub thread-net"></span></span><span class="thread-total"></span><span aria-hidden="true">›</span>`;
    row.querySelector('strong').textContent = contact.name;
    row.querySelector('.sub').textContent = `${contact.address} · ${contact.txs.length} transactions`;
    row.querySelector('.thread-net').textContent = `Tu dois ${formatMoney(debt.owedByMe)} · Te doit ${formatMoney(debt.owedToMe)} USDC`;
    row.querySelector('.thread-total').textContent = `$${formatMoney(Math.round((contact.received + contact.sent) * 100))}`;
    row.addEventListener('click', () => { selectedContact = id; navigate('contact-detail'); });
    list.append(row);
  });
}

function renderGroups() {
  const list = document.getElementById('groupList');
  if (!list) return;
  list.replaceChildren();
  demoGroups.forEach(group => {
    const row = document.createElement('button');
    row.className = 'group-row card';
    row.innerHTML = `<span class="tile"><svg class="icon"><use href="#users-icon"/></svg></span><span class="grow"><strong></strong><span class="sub"></span><span class="sub"></span></span><span aria-hidden="true">›</span>`;
    row.querySelector('strong').textContent = group.name;
    row.querySelector('.sub').textContent = `${group.memberCount} members · $${formatMoney(Math.round(group.total * 100))} total`;
    row.querySelectorAll('.sub')[1].textContent = `⚖ ${group.status}`;
    row.addEventListener('click', () => navigate('group-detail'));
    list.append(row);
  });
}

function renderVaultMembers() {
  const list = document.getElementById('vaultMembers');
  if (!list) return;
  list.replaceChildren();
  const accepted = vaultModel.members.filter(member => member.accepted).length;
  const count = document.getElementById('vaultMemberStatus');
  if (count) count.textContent = `${accepted} / ${vaultModel.members.length} ont accepté les règles`;
  document.querySelectorAll('[data-vault-member-count]').forEach(el => { el.textContent = String(vaultModel.members.length); });
  vaultModel.members.forEach((member, index) => {
    const row = document.createElement('div');
    row.className = 'member';
    row.innerHTML = '<span class="avatar"></span><div class="grow"><strong></strong><span class="sub"></span></div><span class="member-status"></span>';
    row.querySelector('.avatar').textContent = member.name.slice(0, 2).toUpperCase();
    row.querySelector('strong').textContent = member.name;
    row.querySelector('.sub').textContent = `${formatMoney(member.contribution)} USDC déposés`;
    row.querySelector('.member-status').textContent = member.accepted ? 'Règles acceptées' : 'Invitation en attente';
    if (member.accepted) {
      row.querySelector('.member-status').classList.add('accepted-label');
      const check = document.createElement('span');
      check.textContent = '✓';
      check.setAttribute('aria-label', 'Règles acceptées');
      row.append(check);
    }
    row.dataset.memberIndex = String(index);
    list.append(row);
  });
}

function renderVaultDates() {
  document.querySelectorAll('[data-unlock-date]').forEach(el => {
    el.textContent = vaultModel.unlock.toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });
  });
  const utc = document.getElementById('unlockUtc');
  if (utc) utc.textContent = `Date de démo · ${vaultModel.unlock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}

function renderVaultState() {
  document.querySelectorAll('[data-vault-name]').forEach(el => { el.textContent = vaultModel.name; });
  const lockTag = document.getElementById('vaultLockTag');
  const lockDate = document.getElementById('vaultLockDate');
  const depositForm = document.getElementById('depositForm');
  const inviteCard = document.querySelector('.invite-card');
  if (vaultModel.deleted) {
    if (lockTag) lockTag.textContent = 'Vault supprimé';
    if (lockDate) lockDate.textContent = 'Chaque part a été retournée à son déposant.';
    if (depositForm) depositForm.hidden = true;
    if (inviteCard) inviteCard.hidden = true;
  } else {
    if (lockTag) lockTag.textContent = 'Fonds bloqués';
    if (lockDate) {
      lockDate.replaceChildren(document.createTextNode('Fonds bloqués jusqu’au '));
      const date = document.createElement('span');
      date.dataset.unlockDate = '';
      lockDate.append(date);
    }
    if (depositForm) depositForm.hidden = false;
    if (inviteCard) inviteCard.hidden = false;
  }
  const approvals = document.getElementById('deleteApprovalCount');
  if (approvals) approvals.textContent = `${vaultModel.deleteApprovals.size} / ${vaultModel.members.length}`;
  const approve = document.getElementById('approveDeleteButton');
  if (approve) approve.textContent = vaultModel.deleteApprovals.has('@demo.atara') ? 'Retirer ma confirmation' : 'Confirmer pour moi';
  const other = document.getElementById('simulateOtherApprovals');
  const confirm = document.getElementById('confirmDeleteVault');
  const ready = vaultModel.deleteApprovals.size === vaultModel.members.length && vaultModel.members.length > 0;
  if (other) other.hidden = vaultModel.deleted || ready;
  if (confirm) confirm.hidden = vaultModel.deleted || !ready;
  const deleteButton = document.getElementById('deleteVaultButton');
  if (deleteButton) { deleteButton.disabled = vaultModel.deleted || vaultModel.totalWithdrawn > 0; deleteButton.textContent = vaultModel.deleted ? 'Vault supprimé' : 'Demander la suppression'; }
  renderVaultMembers();
  renderVaultDates();
  window.renderPilotVault?.();
}

function renderVaultInviteSuggestions(inputId, listId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;
  const raw = input.value.trim().toLocaleLowerCase('fr');
  if (!raw.startsWith('@')) { list.hidden = true; return; }
  const query = raw.slice(1);
  const matches = demoContacts.filter(contact => !query || contact.handle.includes(query) || contact.name.toLocaleLowerCase('fr').includes(query));
  list.replaceChildren();
  matches.forEach(contact => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'contact-suggestion';
    option.innerHTML = '<span class="avatar"></span><span class="grow"><strong></strong><span class="sub"></span></span><span aria-hidden="true">＋</span>';
    option.querySelector('.avatar').textContent = contact.name.slice(0, 2).toUpperCase();
    option.querySelector('strong').textContent = `@${contact.handle}`;
    option.querySelector('.sub').textContent = contact.name;
    option.addEventListener('click', () => { input.value = `@${contact.handle}`; list.hidden = true; });
    list.append(option);
  });
  list.hidden = matches.length === 0;
}

function renderContactDetail() {
  const contact = activityContacts[selectedContact] || activityContacts.marcus;
  const debt = AtaraLedger.balances(demoGroups, 'me', contact.name.slice(1));
  const content = document.getElementById('contactDetailContent');
  content.replaceChildren();
  const summary = document.createElement('div');
  summary.innerHTML = `<div class="contact-hero"><span class="avatar">${contact.name.slice(1, 3).toUpperCase()}</span><div><h2></h2><p class="sub"></p></div></div><div class="card financial-summary"><div class="summary-title">ÉCHANGES · ESTIMATION FICTIVE</div><div class="summary-grid"><span>↙ RECEIVED <strong class="received"></strong></span><span>↗ SENT <strong class="sent"></strong></span></div><div class="summary-rule"></div><p class="summary-net-label">PARTS ACCEPTÉES DANS GROUPS</p><strong class="summary-net"></strong></div><div class="contact-transactions"></div><button class="primary send-contact">↗ Send to contact</button>`;
  summary.querySelector('h2').textContent = contact.name;
  summary.querySelector('.sub').textContent = contact.address;
  summary.querySelector('.received').textContent = `$${formatMoney(Math.round(contact.received * 100))}`;
  summary.querySelector('.sent').textContent = `$${formatMoney(Math.round(contact.sent * 100))}`;
  summary.querySelector('.summary-net').textContent = `Tu dois ${formatMoney(debt.owedByMe)} USDC · Te doit ${formatMoney(debt.owedToMe)} USDC. Les transferts seuls ne créent pas de dette.`;
  const transactions = summary.querySelector('.contact-transactions');
  contact.txs.forEach(tx => {
    const row = document.createElement('div');
    row.className = 'contact-tx card';
    row.innerHTML = `<span class="tile"><svg class="icon"><use href="#${tx.icon}"/></svg></span><span class="grow"><strong></strong><span class="sub"></span></span><span class="amount"></span>`;
    row.querySelector('strong').textContent = tx.title;
    row.querySelector('.sub').textContent = tx.date;
    row.querySelector('.amount').textContent = formatSigned(tx.amount);
    row.querySelector('.amount').classList.toggle('positive', tx.amount > 0);
    transactions.append(row);
  });
  summary.querySelector('.send-contact').addEventListener('click', () => { document.getElementById('recipient').value = contact.name; navigate('send'); });
  content.append(summary);
}

function renderGroupDetail() {
  const content = document.getElementById('groupDetailContent');
  content.innerHTML = `<div class="group-hero"><span class="tile"><svg class="icon"><use href="#users-icon"/></svg></span><h2>weekend paris</h2><p class="sub">Sortie à plusieurs · 2 membres</p></div><div class="card group-policy"><div class="summary-title">⚖ GROUP BALANCE</div><div class="group-balance-line"><span>Toi</span><strong>$0.00</strong></div><div class="group-balance-line"><span>@marcuschen</span><strong>settled</strong></div><p class="footnote">Ajoute une dépense quand tu avances le restaurant, les billets ou les courses. Chaque part sera visible ici et dans Activity.</p></div><div class="section-label">Dépenses</div><div class="card expense-row"><span class="tile"><svg class="icon"><use href="#pay-icon"/></svg></span><span class="grow"><strong>Aucune dépense</strong><span class="sub">Le groupe est à jour</span></span><span class="tag">Settled</span></div><button class="primary add-expense-demo">+ Ajouter une dépense</button><p id="groupDetailNotice" class="notice" role="status" hidden></p><p class="footnote">La collecte automatique restera désactivée par défaut. Si tu l’actives plus tard, chaque membre donnera son accord, avec un plafond et un contrôle de solde avant toute demande.</p>`;
  content.querySelector('.add-expense-demo').addEventListener('click', () => { demoGroups[0].total = 120; demoGroups[0].status = '1 balance pending'; renderGroups(); notice('groupDetailNotice', 'Dépense de 120 USDC ajoutée en simulation : 60 USDC à Marcus.', false); });
}

document.querySelectorAll('[data-activity-tab]').forEach(button => button.addEventListener('click', () => {
  activityTab = button.dataset.activityTab;
  document.querySelectorAll('[data-activity-tab]').forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
  document.querySelectorAll('[data-activity-panel]').forEach(panel => { panel.hidden = panel.dataset.activityPanel !== activityTab; });
  if (activityTab === 'contacts') renderContacts(document.getElementById('activitySearch').value);
  if (activityTab === 'groups') renderGroups();
}));
document.getElementById('activitySearch').addEventListener('input', event => {
  if (activityTab === 'contacts') renderContacts(event.target.value);
  if (activityTab === 'transactions') renderActivity('fullActivity', activity.filter(item => item.title.toLowerCase().includes(event.target.value.toLowerCase())));
  if (activityTab === 'groups') renderGroups();
});

function addActivity(title, amount, icon, symbol = 'USDC', unitAmount = null) {
  activity.unshift({ title, amount, icon, symbol, unitAmount, date: 'À l’instant · simulation' });
}

function renderActivity(id, items) {
  const list = document.getElementById(id);
  list.replaceChildren();
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'activity-row';
    // Only our fixed icon identifiers enter HTML. All labels use textContent.
    row.innerHTML = `<span class="tile"><svg class="icon" aria-hidden="true"><use href="#${item.icon}"/></svg></span><div class="grow"><strong></strong><span class="sub"></span></div><span class="amount"></span>`;
    row.querySelector('strong').textContent = item.title;
    row.querySelector('.sub').textContent = item.date;
    const amount = row.querySelector('.amount');
    amount.classList.toggle('positive', item.amount > 0);
    const symbol = item.symbol || 'USDC';
    if (symbol !== 'USDC' && item.unitAmount !== null && item.unitAmount !== undefined) {
      amount.textContent = `${item.unitAmount > 0 ? '+' : '−'}${formatCryptoAmount(Math.abs(item.unitAmount), cryptoAssets.find(asset => asset.symbol === symbol) || cryptoAssets[0])} ${symbol}`;
    } else {
      amount.textContent = `${item.amount > 0 ? '+' : '−'}${formatMoney(Math.abs(item.amount))} USDC`;
    }
    list.append(row);
  });
}

function refresh() {
  document.querySelectorAll('[data-balance]').forEach(el => { el.textContent = formatMoney(state.balance); });
  renderCryptoCarousel();
  renderPaymentAssetControls();
  document.querySelectorAll('[data-vault]').forEach(el => { el.textContent = formatMoney(state.vault); });
  renderVaultState();
  renderActivity('activity', activity.slice(0, 5));
  renderActivity('fullActivity', activity);
  renderContacts();
  renderGroups();
}

function notice(id, message, error = false, fieldId) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.hidden = false;
  el.classList.toggle('error', error);
  if (fieldId) {
    const field = document.getElementById(fieldId);
    field.setAttribute('aria-invalid', String(error));
    if (error) field.focus();
  }
}

function amountFrom(fieldId, noticeId) {
  const amount = readAmount(document.getElementById(fieldId).value);
  if (amount === null) notice(noticeId, 'Saisis un montant de 0,01 à 100 000, avec au maximum deux décimales.', true, fieldId);
  else document.getElementById(fieldId).removeAttribute('aria-invalid');
  return amount;
}

function readAssetAmount(raw, decimals = 8) {
  const value = raw.trim().replace(',', '.');
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [, fraction = ''] = value.split('.');
  if (fraction.length > decimals) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 100000000 ? amount : null;
}

document.querySelectorAll('[data-amount]').forEach(button => button.addEventListener('click', () => {
  document.getElementById('buyAmount').value = button.dataset.amount;
  document.getElementById('buyAmount').removeAttribute('aria-invalid');
  document.getElementById('buyNotice').hidden = true;
}));
document.querySelectorAll('form[novalidate] input').forEach(input => input.addEventListener('input', () => {
  input.removeAttribute('aria-invalid');
  const notice = input.closest('form').querySelector('.notice'); if (notice) notice.hidden = true;
}));

document.getElementById('buyForm').addEventListener('submit', event => {
  event.preventDefault();
  const amount = amountFrom('buyAmount', 'buyNotice');
  if (amount === null) return;
  state.balance += amount;
  addActivity('Achat simulé', amount, 'down-icon');
  refresh();
  notice('buyNotice', `${formatMoney(amount)} USDC fictifs ajoutés au compte. Aucun achat réel effectué.`);
});

document.getElementById('receiveButton').addEventListener('click', () => receiveDialog.showModal());
document.getElementById('receiveDemo').addEventListener('click', () => {
  state.balance += 2500;
  addActivity('Réception simulée', 2500, 'down-icon');
  refresh();
  receiveDialog.close();
  document.getElementById('balanceBlock').hidden = false;
  document.getElementById('balanceToggle').setAttribute('aria-expanded', 'true');
  document.getElementById('balanceToggle').setAttribute('aria-label', 'Masquer le solde fictif');
});

document.getElementById('passkeyButton').addEventListener('click', event => {
  securityState.passkey = true;
  document.getElementById('passkeyStatus').textContent = 'Passkey prête pour cet appareil · simulation';
  document.getElementById('passkeyDot').classList.add('enabled');
  document.getElementById('passkeyDot').setAttribute('aria-label', 'Passkey activée');
  event.currentTarget.textContent = 'Passkey activée';
  event.currentTarget.disabled = true;
});

document.getElementById('twofaButton').addEventListener('click', event => {
  securityState.twofa = true;
  document.getElementById('twofaStatus').textContent = 'Application d’authentification activée · simulation';
  document.getElementById('twofaDot').classList.add('enabled');
  document.getElementById('twofaDot').setAttribute('aria-label', '2FA activée');
  event.currentTarget.textContent = '2FA activée';
  event.currentTarget.disabled = true;
});

document.getElementById('backupForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('backupPhone');
  const normalized = input.value.replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    notice('backupNotice', 'Saisis un numéro international valide, par exemple +33 6 00 00 00 00.', true, 'backupPhone');
    return;
  }
  securityState.backupPhone = ''; // Demo does not retain phone numbers.
  input.removeAttribute('aria-invalid');
  const masked = normalized.slice(0, 4) + ' •••• ' + normalized.slice(-2);
  notice('backupNotice', `Numéro de récupération enregistré pour la démo : ${masked}. Aucun SMS envoyé.`);
});

document.getElementById('applePayButton').addEventListener('click', () => {
  notice('cardNotice', 'Aperçu du parcours carte · simulation, émission non activée. Aucun wallet Apple ni paiement réel n’est connecté.');
});

document.getElementById('payForm').addEventListener('submit', event => {
  event.preventDefault();
  const asset = selectedPaymentAsset();
  const address = document.getElementById('merchant').value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address)) {
    notice('payNotice', 'Saisis une adresse au format 0x suivie de 40 caractères hexadécimaux, différente de l’adresse nulle.', true, 'merchant');
    return;
  }
  document.getElementById('merchant').removeAttribute('aria-invalid');
  const amount = readAssetAmount(document.getElementById('payAmount').value, asset.decimals);
  if (amount === null) return notice('payNotice', `Saisis un montant valide en ${asset.symbol}.`, true, 'payAmount');
  document.getElementById('payAmount').removeAttribute('aria-invalid');
  if (amount > demoAssetBalance(asset)) return notice('payNotice', `Ton solde fictif en ${asset.symbol} est insuffisant.`, true, 'payAmount');
  const unitPrice = demoAssetUnitPrice(asset);
  const usdCents = Math.round(amount * unitPrice * 100);
  if (asset.symbol === 'USDC') state.balance -= Math.round(amount * 100);
  else {
    asset.amount = Math.max(0, asset.amount - amount);
    asset.usdValue = Math.max(0, asset.amount * unitPrice);
  }
  addActivity('Courses · paiement simulé', -usdCents, 'pay-icon', asset.symbol, -amount);
  refresh();
  notice('payNotice', `Paiement de ${formatCryptoAmount(amount, asset)} ${asset.symbol} simulé. Aucun transfert réel effectué.`);
});

document.getElementById('sendForm').addEventListener('submit', event => {
  event.preventDefault();
  const asset = selectedPaymentAsset();
  const contact = document.getElementById('recipient').value.trim().toLowerCase().replace(/^@/, '');
  if (!contacts.has(contact)) return notice('sendNotice', 'Choisis un contact dans les suggestions @.', true, 'recipient');
  document.getElementById('recipient').removeAttribute('aria-invalid');
  const amount = readAssetAmount(document.getElementById('sendAmount').value, asset.decimals);
  if (amount === null) return notice('sendNotice', `Saisis un montant valide en ${asset.symbol}.`, true, 'sendAmount');
  document.getElementById('sendAmount').removeAttribute('aria-invalid');
  if (amount > demoAssetBalance(asset)) return notice('sendNotice', `Ton solde fictif en ${asset.symbol} est insuffisant.`, true, 'sendAmount');
  const unitPrice = demoAssetUnitPrice(asset);
  const usdCents = Math.round(amount * unitPrice * 100);
  if (asset.symbol === 'USDC') state.balance -= Math.round(amount * 100);
  else {
    asset.amount = Math.max(0, asset.amount - amount);
    asset.usdValue = Math.max(0, asset.amount * unitPrice);
  }
  addActivity(`@${contact} · envoi simulé`, -usdCents, 'pay-icon', asset.symbol, -amount);
  refresh();
  notice('sendNotice', `Envoi de ${formatCryptoAmount(amount, asset)} ${asset.symbol} à @${contact} simulé. Aucun transfert réel effectué.`);
});

document.getElementById('createVaultButton').addEventListener('click', () => {
  const form = document.getElementById('createVaultForm');
  form.hidden = !form.hidden;
  if (!form.hidden) document.getElementById('createInvite').focus();
});
document.getElementById('createInvite').addEventListener('input', () => renderVaultInviteSuggestions('createInvite', 'createInviteSuggestions'));
document.getElementById('createInvite').addEventListener('focus', () => renderVaultInviteSuggestions('createInvite', 'createInviteSuggestions'));
document.getElementById('createInvite').addEventListener('blur', () => setTimeout(() => { document.getElementById('createInviteSuggestions').hidden = true; }, 120));
document.getElementById('createVaultForm').addEventListener('submit', event => {
  event.preventDefault();
  const invite = document.getElementById('createInvite').value.trim().toLowerCase().replace(/^@/, '');
  const contact = demoContacts.find(item => item.handle === invite);
  const name = document.getElementById('vaultName').value.trim();
  const days = Number(document.getElementById('vaultDays').value);
  if (!name || !contact || !Number.isInteger(days) || days < 1 || days > 365) {
    return notice('createVaultNotice', 'Choisis un nom, un contact suggéré et une durée de 1 à 365 jours.', true);
  }
  window.saveCurrentDemoVault?.();
  vaultModel = { name, unlock: new Date(), deleted: false, totalWithdrawn: 0, members: [], deleteApprovals: new Set() };
  window.registerDemoVault?.(vaultModel);
  vaultModel.name = name;
  vaultModel.unlock = new Date();
  vaultModel.unlock.setUTCDate(vaultModel.unlock.getUTCDate() + days);
  vaultModel.unlock.setUTCHours(12, 0, 0, 0);
  vaultModel.deleted = false;
  vaultModel.deleteApprovals.clear();
  vaultModel.members = [
    { handle: '@demo.atara', name: 'Toi', contribution: 0, accepted: true },
    { handle: `@${contact.handle}`, name: contact.name, contribution: 0, accepted: false },
  ];
  state.vault = 0;
  state.contribution = 0;
  addActivity(`${vaultModel.name} · invitations envoyées`, 0, 'users-icon');
  document.getElementById('createInvite').value = '';
  document.getElementById('createVaultForm').hidden = false;
  refresh();
  notice('createVaultNotice', `Vault créé. Invitation envoyée à @${contact.handle}. Les fonds restent bloqués jusqu’au ${vaultModel.unlock.toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })}.`);
});

document.getElementById('vaultInvite').addEventListener('input', () => renderVaultInviteSuggestions('vaultInvite', 'vaultInviteSuggestions'));
document.getElementById('vaultInvite').addEventListener('focus', () => renderVaultInviteSuggestions('vaultInvite', 'vaultInviteSuggestions'));
document.getElementById('vaultInvite').addEventListener('blur', () => setTimeout(() => { document.getElementById('vaultInviteSuggestions').hidden = true; }, 120));
document.getElementById('inviteForm').addEventListener('submit', event => {
  event.preventDefault();
  if (state.vault > 0 || vaultModel.members.every(m => m.accepted)) return notice('inviteNotice', 'La liste des membres est fixée. Crée un nouveau Vault pour changer les participants.', true);
  if (vaultModel.deleted) return notice('inviteNotice', 'Ce Vault est supprimé.', true);
  const invite = document.getElementById('vaultInvite').value.trim().toLowerCase().replace(/^@/, '');
  const contact = demoContacts.find(item => item.handle === invite);
  if (!contact) return notice('inviteNotice', 'Choisis un contact de démonstration suggéré.', true, 'vaultInvite');
  if (vaultModel.members.some(member => member.handle === `@${contact.handle}`)) return notice('inviteNotice', 'Ce contact est déjà membre ou invité.', true, 'vaultInvite');
  if (vaultModel.members.length >= 10) return notice('inviteNotice', 'Un Vault peut contenir au maximum 10 membres.', true, 'vaultInvite');
  vaultModel.members.push({ handle: `@${contact.handle}`, name: contact.name, contribution: 0, accepted: false });
  vaultModel.deleteApprovals.clear();
  document.getElementById('vaultInvite').value = '';
  refresh();
  notice('inviteNotice', `Invitation envoyée à @${contact.handle}. Il devra accepter les règles avant tout dépôt.`);
});

document.getElementById('depositForm').addEventListener('submit', event => {
  event.preventDefault();
  if (vaultModel.deleted) return notice('depositNotice', 'Ce Vault est supprimé : aucun nouveau dépôt possible.', true);
  if (!vaultModel.members.every(m => m.accepted)) return notice('depositNotice', 'Tous les membres doivent accepter les règles avant le dépôt.', true);
  if (new Date() >= vaultModel.unlock) return notice('depositNotice', 'La période de dépôt est terminée.', true);
  const amount = amountFrom('depositAmount', 'depositNotice');
  if (amount === null) return;
  if (state.vault + amount > 1000000) return notice('depositNotice', 'Plafond de démo : 10 000 USDC par Vault.', true);
  if (amount > state.balance) return notice('depositNotice', 'Ton solde fictif est insuffisant pour ce dépôt.', true, 'depositAmount');
  state.balance -= amount;
  state.vault += amount;
  state.contribution += amount;
  vaultModel.members[0].contribution = state.contribution;
  addActivity('Dépôt au Vault simulé', -amount, 'lock-icon');
  refresh();
  notice('depositNotice', `${formatMoney(amount)} USDC fictifs déposés dans le Vault. Aucun transfert réel effectué.`);
});

document.getElementById('deleteVaultButton').addEventListener('click', () => {
  if (!vaultModel.deleted) document.getElementById('deleteVaultPanel').hidden = false;
});
document.getElementById('approveDeleteButton').addEventListener('click', () => {
  if (vaultModel.deleted) return;
  if (vaultModel.deleteApprovals.has('@demo.atara')) vaultModel.deleteApprovals.delete('@demo.atara');
  else vaultModel.deleteApprovals.add('@demo.atara');
  refresh();
  notice('deleteVaultNotice', vaultModel.deleteApprovals.has('@demo.atara') ? 'Ta confirmation est enregistrée. Il faut l’accord de tous les membres.' : 'Ta confirmation a été retirée.');
});
document.getElementById('simulateOtherApprovals').addEventListener('click', () => {
  if (vaultModel.deleted) return;
  vaultModel.members.forEach(member => vaultModel.deleteApprovals.add(member.handle));
  refresh();
  notice('deleteVaultNotice', 'Simulation : tous les membres ont confirmé. Tu peux maintenant rembourser chaque part.');
});
document.getElementById('confirmDeleteVault').addEventListener('click', () => {
  if (vaultModel.deleted || vaultModel.totalWithdrawn > 0 || vaultModel.deleteApprovals.size !== vaultModel.members.length) return;
  const refunded = vaultModel.members.map(m => `${m.name} : ${formatMoney(m.contribution)} USDC`).join(' · ');
  const returned = state.contribution;
  state.balance += returned;
  state.vault = 0;
  state.contribution = 0;
  vaultModel.members = vaultModel.members.map(member => ({ ...member, contribution: 0 }));
  vaultModel.deleted = true;
  addActivity('Vault supprimé · part remboursée', returned, 'lock-icon');
  refresh();
  notice('deleteVaultNotice', `Vault supprimé. ${formatMoney(returned)} USDC fictifs ont été rendus à ton compte ; détail des restitutions fictives : ${refunded}.`);
});

refresh();
renderContactDetail();
renderGroupDetail();
show(location.hash.slice(1), false);
