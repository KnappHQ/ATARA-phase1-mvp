# Network fees (gas)

## Today (beta, Base Sepolia)

Every payment asks Alchemy's Gas Manager to sponsor the network fee
(`paymaster: { policyId }`, `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID`). The account holds no ETH and
does not need any. If the sponsor refuses, the payment is refused: nothing is sent and nothing
is charged.

The banner "Gas sponsorship is unavailable or its limit has been reached" is shown only for
refusals that come from the sponsor (`utils/gasFailure.ts`): paymaster, policy, quota, spend
limit. Earlier, simulation reverts and `AA23` validation failures were also shown as that
banner, which hid the real cause. They now surface their own message, and the full error is
sent to Sentry (`Send transaction failed`).

Likely causes of a real sponsor refusal on the beta: the policy's spend or per-user limit is
used up, the policy is on another network or app than the API key, or the policy has expired.
Check Alchemy Dashboard → Gas Manager → the policy → Usage / Rules.

## Real money (Base mainnet): the person pays

Not built yet. It needs decisions and set-up that cannot be done from code alone:

1. **Pay in USDC, not ETH.** People will not hold ETH. Alchemy's ERC-20 paymaster
   (`paymaster: { policyId, erc20: { tokenAddress: USDC, ... } }`) takes the fee from the
   account's USDC. It needs a Gas Manager policy configured for ERC-20 payment on Base mainnet
   (Alchemy dashboard), separate from the sponsorship policy.
2. **Show the fee before signing.** The review screen currently says the fee is paid by ATARA.
   With USDC fees it must show the quoted amount (a prepare-only estimate) and "Network fee"
   must be included in what leaves the account.
3. **Keep sponsorship as an option**, for example for first payments or plan allowances
   (`sponsoredSendsPerMonth`), through `decideSponsorship`, which is not wired into the send
   path yet.
4. **Test on Base Sepolia first** with an ERC-20 policy, before any mainnet build.

Until then the `production` EAS profile (mainnet) must not be built for real users: it would
spend ATARA's sponsorship budget on real payments.
