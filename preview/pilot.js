'use strict';
const el = (tag, cls = '', text = '') => { const node = document.createElement(tag); node.className = cls; node.textContent = text; return node; };
const action = (label, handler, secondary = false) => { const button = el('button', secondary ? 'secondary' : 'primary', label); button.type = 'button'; button.addEventListener('click', handler); return button; };
const displayMember = id => id === 'me' ? 'Toi' : `@${id}`;
function openPanel(title) {
  const dialog = el('dialog', 'pilot-dialog'); const box = el('div', 'pilot-dialog-body');
  box.append(el('h2', '', title)); dialog.append(box);
  const close = action('Fermer', () => { dialog.close(); dialog.remove(); }, true);
  box.append(close); document.body.append(dialog); dialog.showModal(); return { dialog, box, close };
}
function field(parent, label, value = '', type = 'text') {
  const id = `field-${crypto.randomUUID()}`;
  const caption = el('label', 'field-label', label); caption.htmlFor = id;
  const input = el('input', 'text-input'); input.type = type; input.id = id; input.value = value;
  parent.append(caption, input); return input;
}
function pilotNotice(parent, message) {
  let node = parent.querySelector('.pilot-notice'); if (!node) { node = el('p', 'notice pilot-notice'); node.setAttribute('role', 'status'); parent.append(node); } node.textContent = message;
}
function selectedGroup() { return demoGroups.find(g => g.id === selectedGroupId) || demoGroups[0]; }
function recordSocialTransfer(from, to, amount, label) {
  const other = from === 'me' ? to : from;
  let contact = Object.values(activityContacts).find(c => c.name === `@${other}`);
  if (!contact) { contact = { name: `@${other}`, address: 'Contact de démonstration', received: 0, sent: 0, txs: [] }; activityContacts[other] = contact; }
  const signed = from === 'me' ? -amount : amount;
  contact[from === 'me' ? 'sent' : 'received'] += amount / 100;
  contact.txs.unshift({ title: label, amount: signed / 100, date: new Date().toLocaleString('fr-FR'), icon: signed > 0 ? 'arrow-down-left-icon' : 'arrow-up-icon' });
  addActivity(`${displayMember(other)} · ${label}`, signed, signed > 0 ? 'down-icon' : 'pay-icon');
}
renderGroups = function () {
  const list = document.getElementById('groupList'); list.replaceChildren();
  const query = document.getElementById('activitySearch').value.toLowerCase();
  demoGroups.filter(g => g.name.toLowerCase().includes(query)).forEach(g => {
    const row = el('button', 'group-row card'); const tile = el('span', 'tile', '♧'); const text = el('span', 'grow');
    const pending = g.expenses.flatMap(e => e.splits).filter(s => !s.settled && s.decision === 'pending').length;
    const outstanding = g.expenses.flatMap(e => e.splits).filter(s => !s.settled && s.decision === 'accepted').length;
    text.append(el('strong', '', g.name), el('span', 'sub', `${g.members.length} membres · ${formatMoney(g.expenses.reduce((sum, e) => sum + e.amount, 0))} USDC déclarés`), el('span', 'sub', `${pending} part(s) à valider · ${outstanding} à rembourser`));
    row.append(tile, text, el('span', '', '›')); row.onclick = () => { selectedGroupId = g.id; navigate('group-detail'); }; list.append(row);
  });
};
renderGroupDetail = function () {
  const group = selectedGroup(), content = document.getElementById('groupDetailContent'); content.replaceChildren();
  const hero = el('div', 'group-hero'); hero.append(el('h2', '', group.name), el('p', 'sub', `${group.members.length} membres · Dépenses en USDC`)); content.append(hero);
  content.append(el('p', 'footnote', 'Groups sert à noter ce que chacun avance pour une sortie. Chaque part doit être acceptée. Le Vault sert à mettre des fonds en commun avec des règles de retrait.'));
  group.members.filter(id => id !== 'me').forEach(id => {
    const balance = AtaraLedger.balances([group], 'me', id); const row = el('div', 'card pilot-balance');
    row.append(el('strong', '', displayMember(id)), el('p', 'sub', `Tu dois ${formatMoney(balance.owedByMe)} · Te doit ${formatMoney(balance.owedToMe)} USDC`));
    if (balance.pending) row.append(el('p', 'footnote', `${formatMoney(balance.pending)} USDC proposés ou contestés, exclus des dettes acceptées.`));
    function pay(from, to) {
      const due = AtaraLedger.balances([group], from, to).owedByMe;
      const review = openPanel('Confirmer le remboursement fictif');
      review.box.insertBefore(el('p', 'sub', `${displayMember(from)} → ${displayMember(to)} : ${formatMoney(due)} USDC · Aucun fonds réel.`), review.close);
      review.box.insertBefore(action('Confirmer la simulation', () => {
        try {
          if (from === 'me' && state.balance < due) throw Error('Solde fictif insuffisant. Ajoute des USDC de démonstration.');
          const amount = AtaraLedger.settle(group, from, to, crypto.randomUUID(), usedDemoReceipts);
          state.balance += from === 'me' ? -amount : amount;
          recordSocialTransfer(from, to, amount, `Remboursement ${group.name}`); review.dialog.close(); review.dialog.remove(); refresh(); renderGroupDetail();
        } catch (error) { pilotNotice(review.box, error.message); }
      }), review.close);
    }
    if (balance.owedByMe) row.append(action('Rembourser ma part (simulation)', () => pay('me', id)));
    if (balance.owedToMe) {
      row.append(action(`Simuler son remboursement`, () => pay(id, 'me'), true));
      row.append(action('Partager un rappel', async () => {
        const text = `Salut ${displayMember(id)}, ta part acceptée dans ${group.name} est de ${formatMoney(balance.owedToMe)} USDC. Démonstration ATARA, aucun paiement réel demandé.`;
        try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); pilotNotice(row, 'Rappel prêt dans le partage ou copié.'); } catch { pilotNotice(row, text); }
      }, true));
    }
    content.append(row);
  });
  content.append(action('+ Ajouter une dépense', () => addGroupExpense(group)));
  content.append(el('h3', 'section-label', 'Dépenses et validations'));
  if (!group.expenses.length) content.append(el('p', 'sub', 'Ajoute par exemple un restaurant à 120 USDC. Tu peux choisir qui a avancé et la part de chacun.'));
  group.expenses.forEach(expense => {
    const card = el('div', 'card pilot-expense'); card.append(el('strong', '', expense.label), el('p', 'sub', `${displayMember(expense.paidBy)} déclare avoir avancé ${formatMoney(expense.amount)} USDC`));
    expense.splits.forEach(share => {
      const line = el('div', 'pilot-share');
      line.append(el('p', '', `${displayMember(share.id)} · ${formatMoney(share.amount)} USDC`), el('span', `status-pill ${share.decision}`, share.settled ? 'Réglée' : { pending: 'À valider', accepted: 'Acceptée', disputed: 'Contestée' }[share.decision]));
      if (!share.settled) {
        const prefix = share.id === 'me' ? '' : 'Simuler : ';
        if (share.decision !== 'accepted') line.append(action(`${prefix}accepter`, () => { share.decision = 'accepted'; refresh(); renderGroupDetail(); }, true));
        if (share.decision !== 'disputed') line.append(action(`${prefix}contester`, () => { share.decision = 'disputed'; refresh(); renderGroupDetail(); }, true));
      }
      card.append(line);
    }); content.append(card);
  });
};
function addGroupExpense(group) {
  const panel = openPanel('Partager une dépense');
  const payerLabel = el('label', 'field-label', 'Qui a avancé ?'); payerLabel.htmlFor = 'expense-payer';
  const payer = el('select', 'text-input'); payer.id = 'expense-payer'; group.members.forEach(id => { const option = el('option', '', displayMember(id)); option.value = id; payer.append(option); });
  panel.box.insertBefore(payerLabel, panel.close); panel.box.insertBefore(payer, panel.close);
  const form = el('div'); panel.box.insertBefore(form, panel.close);
  const label = field(form, 'Libellé', 'Restaurant'); label.maxLength = 140;
  const amount = field(form, 'Total en USDC', '120'); amount.inputMode = 'decimal';
  const modeLabel = el('label', 'field-label', 'Répartition'); modeLabel.htmlFor = 'expense-mode';
  const mode = el('select', 'text-input'); mode.id = 'expense-mode'; ['Parts égales', 'Personnalisée'].forEach((label, i) => { const option = el('option', '', label); option.value = String(i); mode.append(option); });
  form.append(modeLabel, mode); const inputs = {};
  group.members.forEach(id => { inputs[id] = field(form, `Part de ${displayMember(id)} (USDC)`, '0'); inputs[id].inputMode = 'decimal'; });
  function preview() {
    let total; try { total = AtaraLedger.cents(amount.value); } catch { total = 0; }
    const ids = [...group.members].sort();
    ids.forEach((id, i) => { inputs[id].disabled = mode.value === '0'; if (mode.value === '0') inputs[id].value = ((Math.floor(total / ids.length) + (i < total % ids.length ? 1 : 0)) / 100).toFixed(2); });
  }
  amount.oninput = preview; mode.onchange = preview; preview();
  form.append(el('p', 'footnote', 'Une proposition ne débite personne. Elle reste à valider par chacun.'));
  form.append(action('Proposer les parts', () => {
    try { AtaraLedger.expense(group, payer.value, label.value, amount.value, mode.value === '1' ? Object.fromEntries(group.members.map(id => [id, inputs[id].value])) : undefined); panel.dialog.close(); panel.dialog.remove(); refresh(); renderGroupDetail(); }
    catch (error) { pilotNotice(form, error.message); }
  }));
}
function createGroupPanel() {
  const panel = openPanel('Créer un groupe'); const form = el('div'); panel.box.insertBefore(form, panel.close);
  const name = field(form, 'Nom du groupe', 'Restaurant entre amis'); name.maxLength = 60;
  form.append(el('p', 'sub', 'Choisis tes contacts à inviter dans cette démonstration.'));
  const selected = new Set();
  demoContacts.forEach(contact => {
    const label = el('label', 'pilot-check'); const check = el('input'); check.type = 'checkbox';
    check.onchange = () => check.checked ? selected.add(contact.handle) : selected.delete(contact.handle);
    label.append(check, document.createTextNode(` ${contact.name} · @${contact.handle}`)); form.append(label);
  });
  form.append(action('Créer le groupe de démonstration', () => {
    if (!name.value.trim() || !selected.size) return pilotNotice(form, 'Choisis un nom et au moins un contact.');
    const group = { id: crypto.randomUUID(), name: name.value.trim(), members: ['me', ...selected], expenses: [], sequence: 0 }; demoGroups.push(group); selectedGroupId = group.id;
    panel.dialog.close(); panel.dialog.remove(); refresh(); navigate('group-detail');
  }));
}
const oldNewGroup = document.querySelector('#activity-screen [data-screen="group-detail"]');
if (oldNewGroup) { const replacement = oldNewGroup.cloneNode(true); replacement.removeAttribute('data-screen'); replacement.onclick = createGroupPanel; oldNewGroup.replaceWith(replacement); }

// Multiple simulated vaults preserve contributions when switching or creating.
const demoVaults = [vaultModel];
window.saveCurrentDemoVault = () => { vaultModel.savedBalance = state.vault; vaultModel.savedContribution = state.contribution; };
window.saveCurrentDemoVault();
window.registerDemoVault = model => demoVaults.push(model);
const picker = el('select', 'text-input'); picker.setAttribute('aria-label', 'Choisir un Vault');
const pickerLabel = el('label', 'field-label', 'Mes Vaults'); pickerLabel.htmlFor = 'pilot-vault-picker'; picker.id = 'pilot-vault-picker';
document.querySelector('#vault .vault-toolbar').after(pickerLabel, picker);
picker.onchange = () => { window.saveCurrentDemoVault(); vaultModel = demoVaults[Number(picker.value)]; state.vault = vaultModel.savedBalance ?? 0; state.contribution = vaultModel.savedContribution ?? 0; refresh(); };
window.renderPilotVault = () => {
  picker.replaceChildren(); demoVaults.forEach((v, i) => { const option = el('option', '', `${v.name}${v.deleted ? ' · fermé' : ''}`); option.value = String(i); option.selected = v === vaultModel; picker.append(option); });
  document.querySelectorAll('#vaultMembers .member').forEach((row, i) => {
    if (!vaultModel.members[i].accepted) row.append(action('Simuler son acceptation', () => { vaultModel.members[i].accepted = true; refresh(); }, true));
  });
  const rule = document.querySelector('#vault .vault-delete-card .footnote');
  rule.textContent = 'Annulation possible avant la date uniquement avec l’accord de tous et sans retrait antérieur. Chaque contribution est alors remboursée. Après un retrait, le solde restant doit faire l’objet d’un nouveau retrait unanime.';
  const invite = document.querySelector('#vault .invite-card');
  invite.hidden = vaultModel.deleted || state.vault > 0 || vaultModel.members.every(m => m.accepted);
  window.saveCurrentDemoVault();
};

// A shareable demo request is explicitly fictitious and never an on-chain invoice.
function requestPanel() {
  const panel = openPanel('Demande de paiement · simulation'); const form = el('div'); panel.box.insertBefore(form, panel.close);
  const amount = field(form, 'Montant fictif en USDC', '25'); amount.inputMode = 'decimal';
  const note = field(form, 'Note', 'Restaurant'); note.maxLength = 140;
  form.append(action('Créer un lien de démonstration', async () => {
    try {
      const value = AtaraLedger.cents(amount.value); const expires = Date.now() + 86400000;
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ amount: value, note: note.value, expires }))));
      const url = `${location.origin}${location.pathname}#request=${encodeURIComponent(payload)}`;
      pilotNotice(form, `Demande fictive : ${formatMoney(value)} USDC · expiration ${new Date(expires).toLocaleString('fr-FR')}.`);
      const output = el('input', 'text-input'); output.readOnly = true; output.value = url; output.setAttribute('aria-label', 'Lien de démonstration'); form.append(output);
      form.append(action('Partager le lien', async () => { try { if (navigator.share) await navigator.share({ url, title: 'Demande ATARA de démonstration' }); else await navigator.clipboard.writeText(url); } catch { output.select(); } }, true));
      form.append(action('Prévisualiser le destinataire', () => { panel.dialog.close(); panel.dialog.remove(); location.hash = `request=${encodeURIComponent(payload)}`; }, true));
    } catch (error) { pilotNotice(form, error.message); }
  }));
}
const requestButton = action('Demander un montant', requestPanel, true); document.querySelector('#home .transfer-actions').after(requestButton);
function openSharedRequest() {
  if (!location.hash.startsWith('#request=')) return;
  try {
    const encoded = decodeURIComponent(location.hash.slice(9)); if (encoded.length > 1200) throw Error('Lien trop long.');
    const request = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    if (!Number.isSafeInteger(request.amount) || request.amount <= 0 || request.amount > 100000000 || typeof request.note !== 'string' || request.note.length > 140 || !Number.isFinite(request.expires)) throw Error('Demande invalide.');
    show('home'); const panel = openPanel('Demande reçue · démonstration');
    panel.box.insertBefore(el('p', 'sub', `${formatMoney(request.amount)} USDC · ${request.note}`), panel.close);
    panel.box.insertBefore(el('p', 'footnote', 'Ce lien est un aperçu fictif et modifiable, sans identité vérifiée. Pour les vrais paiements, ATARA utilise une demande enregistrée et une vérification blockchain.'), panel.close);
    if (request.expires < Date.now()) panel.box.insertBefore(el('p', 'notice', 'Cette demande a expiré.'), panel.close);
    else panel.box.insertBefore(action('Simuler le paiement une fois', event => {
      let used; try { used = sessionStorage.getItem(`atara-demo-request-${encoded}`); } catch {}
      if (used) return pilotNotice(panel.box, 'Déjà simulé dans cette session.');
      if (state.balance < request.amount) return pilotNotice(panel.box, 'Solde fictif insuffisant.');
      state.balance -= request.amount; try { sessionStorage.setItem(`atara-demo-request-${encoded}`, 'paid'); } catch {}
      event.currentTarget.disabled = true; addActivity('Demande payée · simulation', -request.amount, 'pay-icon'); refresh(); pilotNotice(panel.box, 'Paiement fictif confirmé. Aucun argent réel envoyé.');
    }), panel.close);
  } catch { show('home'); const panel = openPanel('Lien indisponible'); pilotNotice(panel.box, 'Cette demande de démonstration est invalide.'); }
}
window.addEventListener('hashchange', openSharedRequest);

// Export only local fictitious activity. No identity data or phone numbers are sent.
const profile = document.getElementById('profile');
profile.append(action('Exporter mon historique de démonstration', () => {
  const cell = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
  const csv = [['mode','date','description','montant','actif'], ...activity.map(a => ['simulation', a.date, a.title, a.unitAmount ?? a.amount / 100, a.symbol ?? 'USDC'])].map(row => row.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })); const link = el('a'); link.href = url; link.download = 'atara-historique-simulation.csv'; link.click(); URL.revokeObjectURL(url);
}, true));
profile.append(el('p', 'footnote', 'Données fictives. La simulation revient à son état initial au rechargement. Les statistiques automatiques sont désactivées.'));
const securityIntro = el('p', 'footnote', 'Cet écran illustre la sécurité. Aucun compte, passkey, SMS ou facteur réel n’est créé dans la simulation. Utilise un numéro fictif.');
document.querySelector('#security .screen-head').after(securityIntro);
const assetsIntro = el('p', 'footnote', 'BTC, SOL et XMR illustrent une évolution possible. Leur prise en charge native n’est pas active dans l’app Base. Toutes les valeurs de cette simulation sont fictives.');
document.getElementById('balanceBlock').append(assetsIntro);
window.renderPilotVault(); refresh(); renderGroupDetail(); if (location.hash === '#contact-detail') renderContactDetail(); openSharedRequest();
