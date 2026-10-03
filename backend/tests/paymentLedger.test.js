const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node/register');
const { ethers } = require('ethers');
const { cents, splitExpense } = require('../utils/expenseAmounts.ts');
const { matchTokenTransfer, verifyReceiptSigner } = require('../services/paymentProof.service.ts');

test('rejects malformed, excessive and silently rounded amounts', () => {
  for (const input of ['0', '-1', '1.001', '1e2', 'NaN', 'Infinity', '1000000.01', null]) assert.throws(() => cents(input));
  assert.equal(cents('0.01'), 1); assert.equal(cents('1000000'), 100000000);
});
test('equal shares conserve every cent and custom shares must match exactly', () => {
  assert.deepEqual(splitExpense('10', ['c','a','b']), [
    {userId:'a', amount:'3.34'}, {userId:'b', amount:'3.33'}, {userId:'c', amount:'3.33'}]);
  assert.throws(() => splitExpense('10', ['a','a']));
  assert.throws(() => splitExpense('10', ['a','b'], [{userId:'a',amount:'5'},{userId:'b',amount:'4.99'}]));
  assert.throws(() => splitExpense('10', ['a','b'], [{userId:'a',amount:'5'},{userId:'c',amount:'5'}]));
  assert.equal(splitExpense('10', ['a','b'], [{userId:'a',amount:'0'},{userId:'b',amount:'10'}])[0].amount,'0.00');
});
const token = '0x0000000000000000000000000000000000000001';
const from = '0x0000000000000000000000000000000000000002';
const to = '0x0000000000000000000000000000000000000003';
const other = '0x0000000000000000000000000000000000000004';
const abi = new ethers.utils.Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
function log(address=token, sender=from, recipient=to, amount=1000000) {
 return {address, ...abi.encodeEventLog(abi.getEvent('Transfer'),[sender,recipient,amount])};
}
test('receipt matching rejects spoofed token, payer, recipient, zero and ambiguous bundles', () => {
  for (const logs of [[log(other)], [log(token,other)], [log(token,from,other)], [log(token,from,to,0)], [log(),log()]])
    assert.throws(() => matchTokenTransfer(logs,token,to,from));
  const proof = matchTokenTransfer([log(other), log()],token,to,from);
  assert.equal(proof.rawAmount.toString(),'1000000'); assert.equal(proof.sender,from);
});
test('the network fee, paid in USDC to the fee recipient in the same transaction, never hides or doubles the payment', () => {
  // A USDC payment is followed by a second USDC transfer: the fee, taken from the sender by the paymaster.
  const paymaster = '0x0000000000000000000000000000000000000009';
  const proof = matchTokenTransfer([log(token, from, to, 25000000), log(token, from, paymaster, 20000)], token, to, from);
  assert.equal(proof.rawAmount.toString(), '25000000');
  assert.equal(proof.sender, from);
  // Only the payment to the recipient counts: the fee transfer alone proves nothing about them.
  assert.throws(() => matchTokenTransfer([log(token, from, paymaster, 20000)], token, to, from));
});
test('a valid EOA receipt signature is accepted without an RPC request', async () => {
 const wallet=ethers.Wallet.createRandom(); const message='ATARA receipt confirmation\nRequest: test\nTransaction: 0x123';
 await verifyReceiptSigner(wallet.address,message,await wallet.signMessage(message));
 await assert.rejects(verifyReceiptSigner(wallet.address,message,'bad-signature'));
});
