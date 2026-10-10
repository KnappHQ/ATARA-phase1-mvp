# Network fees (ATARA-005)

Users pay the network fee in USDC, from the same account. ATARA no longer sponsors gas, and nobody needs ETH.

## What the user sees

- Before confirming, the review shows `Network fee: about $0.02` (or `less than $0.01`, or `Unavailable`) and what leaves the account, for example `25.00 USDC + fee (max 25.02 USDC)`.
- If the fee cannot be calculated, the send is blocked and offers `Try again`. A fee is never shown as 0 or guessed.
- MAX for USDC is the balance minus the largest fee. It waits until a real fee quote exists.
- If the balance cannot cover the amount and the fee: `Not enough USDC to cover this amount and the network fee (about $0.02).` with `Send max (…)`. For another token without USDC for the fee: `You need a little USDC (about $0.02) to pay the network fee.`
- If the real fee at signing time is more than 25 % above what was shown, or no longer fits the balance, nothing is signed or sent. The review reopens with `The network fee changed. Please check and confirm again.`
- No user-facing text says gas, paymaster or sponsorship.

## How it works

- `SmartAccountService.getFeeCapabilities()` asks Alchemy for `paymaster: { policyId, erc20: { tokenAddress: USDC, postOpSettings: { autoApprove: true } } }`. Post-operation mode with an exact approval needs one signature, no permit and no separate approval transaction, and `prepareCalls` keeps returning a `user-operation-v070`. The existing prepare, write the intent, sign, send flow in `services/paymentSubmission.ts` is unchanged, so double-pay protection is unchanged.
- The policy id is still read from `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID`. Its value must now be the id of an ERC-20 policy.
- Quote: `SmartAccountService.estimateFee()` calls `prepareCalls` with `onlyEstimation: true` (so previews do not count against the policy's pending total) and reads `feePayment.maxAmount`. The fee of a transfer does not depend on the amount, so the quote moves one base unit and follows only the recipient and the token (`hooks/useNetworkFee.ts`). The review asks for a fresh quote when it opens.
- Guard: `onPrepared` in `submitAndConfirm` runs on the real prepared payment before anything is written or signed (`utils/networkFee.ts`, `checkPreparedFee`).
- Amounts are bigint base units everywhere in `utils/networkFee.ts`.
- The fee is a second USDC transfer (account to the fee recipient) in the same transaction. Backend payment proof matches by recipient and still finds exactly one payment (see `backend/tests/paymentLedger.test.js`).

## Setup checklist (done by a person, never by code)

1. In the Alchemy dashboard (same app as `EXPO_PUBLIC_ALCHEMY_API_KEY`) create an ERC-20 fee policy ("pay gas with any ERC-20 token"): network Base Sepolia, token USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, post-operation mode, recipient an address ATARA controls. Activate it.
2. Replace the GitHub secret `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID` (synced to EAS by `store-beta.yml`) and your local `.env` with the new policy id.
3. Keep the old sponsorship policy active until builds carrying the new policy id are out: installed builds still use the old id, and deactivating it stops their sends.
4. Fund a test account with USDC from the Circle faucet.

## Before mainnet

- Alchemy needs a paid plan and a custom mainnet limit. Alchemy charges 8 % of the gas it covers, billed to the policy owner. Fees collected in USDC go to the recipient address.
- Create a mainnet ERC-20 policy for Base USDC.
- Fallbacks if Alchemy cannot be made to work: Circle Paymaster or Pimlico ERC-20 paymaster. Both mean leaving the Wallet APIs `wallet_*` flow, a much larger change.

## Manual checks on Base Sepolia (after the setup above)

Account with 0 ETH and 5 test USDC:

- Send 1 USDC: fee shown, sent, balance drops by 1 plus the fee, the recipient gets exactly 1.
- Send max, and an amount above balance minus fee (blocked with the message).
- Airplane mode during the review: fee `Unavailable`, send blocked.
- QR merchant payment, group settlement, and the first payment of a brand-new account.
- Confirm in Activity that the payment shows as one row.
- Confirm the `sendPreparedCalls` request is accepted with the policy id only (the SDK's `sendPreparedCalls` capability schema takes no `erc20` field, so the ERC-20 settings travel in `prepareCalls`).
