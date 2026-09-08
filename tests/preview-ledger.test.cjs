const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../preview/ledger.js');
test('group receipt cannot be reused and a transfer does not create a debt', () => {
 const group={id:'g',members:['me','amy'],expenses:[],sequence:0};
 const expense=L.expense(group,'me','Dinner','10');
 assert.equal(L.balances([group],'me','amy').owedToMe,0);
 expense.splits.find(s=>s.id==='amy').decision='accepted';
 assert.equal(L.balances([group],'me','amy').owedToMe,500);
 const used=new Set(); assert.equal(L.settle(group,'amy','me','receipt-1',used),500);
 assert.equal(L.balances([group],'me','amy').owedToMe,0);
 const second=L.expense(group,'me','Taxi','20'); second.splits.find(s=>s.id==='amy').decision='accepted';
 assert.throws(()=>L.settle(group,'amy','me','receipt-1',used));
 assert.equal(L.balances([group],'me','amy').owedToMe,1000);
});
