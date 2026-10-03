# Network fees: the sender pays, in USDC

ATARA does not sponsor network fees. Each payment pays its own, in USDC, from the same account, through
Alchemy's ERC-20 paymaster ("pay gas with any token"). Nobody needs ETH.

## How a payment works

1. **Quote.** When a recipient and a token are known, the app asks Alchemy for a fee quote
   (`prepareCalls` with `onlyEstimation: true`; nothing is signed). The fee of a transfer does not depend on
   the amount, so it is quoted once per recipient and token. The result is shown as "about $0.02" or "less
   than $0.01". If no usable quote comes back, the fee is "Unavailable" and the payment cannot be sent. A
   fee is never shown as 0.
2. **Balance rules** (`frontend/utils/networkFee.ts`, bigint in USDC base units):
   - Sending USDC: amount + largest fee must fit the USDC balance. MAX = balance minus the largest fee.
     When it does not fit, the app says so and offers "Send max (X USDC)".
   - Sending another token: the account needs a little USDC for the fee.
3. **Review.** The review screen shows the fee, and "Leaves your account" includes the fee
   ("25 USDC + up to 0.03 USDC fee"). "Confirm and pay" is disabled until the fee is known.
4. **Check at signing.** The real payment is prepared with the paymaster capability
   `{ policyId, erc20: { tokenAddress: USDC, postOpSettings: { autoApprove: true } } }` (post-operation,
   exact approval, one signature). Before anything is recorded or signed, the quote is compared with what was
   shown: no quote, a fee more than 25 % above what was shown, or amount + fee above the balance stops the
   payment with nothing sent, and the person confirms again.
5. **Send.** The payment keeps the intent-first flow (`paymentSubmission.ts`). Alchemy's send call only takes
   the policy, so the ERC-20 settings are used on prepare only.

The fee is a second USDC transfer inside the same transaction (account to Alchemy's paymaster). The backend
receipt check matches only the transfer to the recipient (`matchTokenTransfer`), so the fee does not change
verification, and Activity de-duplicates by transaction hash.

## Set-up (NEEDS a person; the code never touches these)

- In the Alchemy dashboard (same app as `EXPO_PUBLIC_ALCHEMY_API_KEY`), create an ERC-20 payments policy:
  network Base Sepolia, token USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, post-operation mode,
  recipient an address ATARA controls. Activate it.
- Replace the value of the GitHub secret `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID` (synced to EAS by
  `store-beta.yml`) with that policy id. The variable keeps its old name so no workflow changes.
- Keep the old sponsorship policy active until new builds are out: installed TestFlight builds carry the old
  id and keep spending ATARA's sponsorship until they update.

## Before real money (Base mainnet)

Alchemy requires a pay-as-you-go or enterprise plan, a custom mainnet limit, a mainnet ERC-20 policy with
Base USDC and a treasury address; Alchemy bills ATARA a share of the gas covered. Do not build the
`production` EAS profile for real users before that exists.

## Test checklist on Base Sepolia (after the policy exists)

- An account with 0 ETH and some test USDC: send 1 USDC. The fee is shown, the payment goes through, the
  balance drops by 1 + fee, the recipient gets exactly 1.
- Send max; an amount that leaves no room for the fee is blocked with a plain message.
- Airplane mode during review: "Unavailable", cannot confirm.
- QR merchant payment, group settlement, and the first payment of a brand-new account.
