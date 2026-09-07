(function (root) {
  'use strict';
  function cents(value, zero = false) {
    const text = String(value).replace(',', '.');
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) throw Error('Montant invalide : deux décimales maximum.');
    const [whole, fraction = ''] = text.split('.');
    const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (n < (zero ? 0 : 1) || n > 100000000) throw Error('Montant hors limites.');
    return n;
  }
  function expense(group, paidBy, label, total, custom) {
    if (!group.members.includes(paidBy) || !label.trim() || label.length > 140) throw Error('Vérifie le payeur et le libellé.');
    const amount = cents(total), ids = [...group.members].sort();
    const splits = ids.map((id, i) => ({ id, amount: custom ? cents(custom[id] ?? '0', true) : Math.floor(amount / ids.length) + (i < amount % ids.length ? 1 : 0), decision: id === paidBy ? 'accepted' : 'pending', settled: id === paidBy }));
    if (splits.reduce((sum, s) => sum + s.amount, 0) !== amount) throw Error('Les parts doivent correspondre exactement au total.');
    splits.filter(s => !s.amount).forEach(s => { s.decision = 'accepted'; s.settled = true; });
    const result = { id: 'expense-' + (++group.sequence), paidBy, label, amount, splits };
    group.expenses.unshift(result); return result;
  }
  function balances(groups, me, other) {
    let owedByMe = 0, owedToMe = 0, pending = 0;
    groups.forEach(g => g.expenses.forEach(e => e.splits.forEach(s => {
      const to = e.paidBy === me && s.id === other, from = e.paidBy === other && s.id === me;
      if ((!to && !from) || s.settled) return;
      if (s.decision !== 'accepted') { pending += s.amount; return; }
      if (to) owedToMe += s.amount; else owedByMe += s.amount;
    })));
    return { owedByMe, owedToMe, pending };
  }
  function settle(group, from, to, receipt, usedReceipts) {
    if (usedReceipts.has(receipt)) throw Error('Ce reçu a déjà été utilisé.');
    const shares = group.expenses.filter(e => e.paidBy === to).flatMap(e => e.splits.filter(s => s.id === from && s.decision === 'accepted' && !s.settled));
    const amount = shares.reduce((sum, s) => sum + s.amount, 0);
    if (!amount) throw Error('Aucune part acceptée à régler.');
    shares.forEach(s => { s.settled = true; s.receipt = receipt; }); usedReceipts.add(receipt); return amount;
  }
  const api = { cents, expense, balances, settle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AtaraLedger = api;
})(typeof window !== 'undefined' ? window : globalThis);
