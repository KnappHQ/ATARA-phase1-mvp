# ATARA Vault — Product and Smart Contract Plan

Status: design only. No contract in this document is approved for mainnet.

## Product objective

ATARA Vault is a non-custodial group savings and rotating-payout feature inspired by a tontine. Members contribute USDC into a smart contract. ATARA never has custody and cannot withdraw, redirect, or freeze the pooled funds.

The closed beta remains on Base Sepolia with test tokens. There is no network selector in the user interface.

## Required user-facing lock notice

Every screen that can add, approve, or withdraw funds must show an absolute date, not only a countdown.

- French primary copy: **Fonds bloqués jusqu’au {date}**
- English localization: **Funds locked until {date}**
- Supporting copy: **Retrait après validation de {approved}/{members} membres**
- The date must include the user's timezone and expose the UTC time in the details view.
- The confirmation screen must repeat the date before a contribution is signed.
- The UI must never imply that reaching the date automatically guarantees a payout: the unanimous approval rule remains visible.

Example:

> Fonds bloqués jusqu’au 30 novembre 2026 à 18:00
>
> Retrait après validation de 3/5 membres

## Proposed lifecycle

1. `DRAFT`: creator defines members, token, contribution amount, schedule, beneficiaries, lock dates, and recovery rule.
2. `ACCEPTING`: every invited member signs the exact immutable terms.
3. `FUNDING`: members deposit the required USDC for the current round.
4. `LOCKED`: funds cannot leave before the round unlock timestamp.
5. `AWAITING_APPROVALS`: after the timestamp, every active member approves the proposed recipient and exact amount.
6. `EXECUTABLE`: the approval threshold is unanimous and the approved payload has not expired or been executed.
7. `PAID`: the contract transfers once, records the round, and advances to the next round.
8. `COMPLETED`: all planned rounds are paid.

No ATARA administrator can skip a state or transfer Vault funds.

## MVP contract architecture

### 1. `AtaraVaultFactory`

Creates one isolated Vault per group using deterministic minimal-proxy deployments. It records approved implementation versions and emits an indexable `VaultCreated` event. It never holds user funds.

### 2. `AtaraGroupVault`

Holds the group's USDC and implements membership, deposits, round deadlines, beneficiaries, unanimous approvals, one-time execution, cancellation rules, and events. Terms become immutable once every member accepts.

Core protections:

- `SafeERC20` transfers;
- checks-effects-interactions and reentrancy protection;
- one execution per round;
- fixed supported token address and decimals;
- exact recipient, amount, round, chain ID, Vault address, nonce, and expiry bound into every approval;
- no arbitrary external calls;
- no owner withdrawal or generic rescue function for the pooled token;
- explicit handling of accidental unrelated-token deposits.

### 3. `VaultApprovalVerifier`

An EIP-712 signature-verification library used by the Vault. Members can sign approvals through their ATARA smart accounts without each member submitting a separate paid transaction. Execution only succeeds when every unique active member has supplied a valid, unexpired signature for the same payout payload.

Contract signatures must support ERC-1271 so ATARA smart accounts can participate, rather than assuming every member is a basic EOA.

## Critical rule still requiring a product decision

Pure unanimity can permanently lock the group if one member loses access, dies, refuses to cooperate, or has a compromised account. This cannot be solved invisibly without weakening the promise that everyone must approve.

One recovery rule must therefore be selected and accepted by every member before funding:

1. **Strict unanimity:** safest interpretation of the promise, but funds may remain locked forever.
2. **Unanimous payout plus delayed pro-rata refunds:** after a long emergency deadline, each contributor can recover only their own recorded principal.
3. **Unanimous payout plus account recovery:** a member key may be replaced through the existing smart-account recovery mechanism; no voting threshold is reduced.

Recommendation for beta: option 3, with option 2 added only after legal and security review.

## Security and testing gates

Before any mainnet deployment:

- unit tests for every state transition and revert path;
- invariant tests proving Vault assets cannot decrease except through an approved payout or defined refund;
- fuzz tests for amounts, dates, duplicate members, signatures, and round transitions;
- replay tests across Vaults, rounds, chains, and expired approvals;
- malicious ERC-1271 signer tests;
- Base Sepolia end-to-end tests with at least five wallets;
- static analysis and gas reporting in CI;
- independent external audit;
- verified source code and deployment manifest;
- initial mainnet deposit and membership caps.

## Additional useful contracts for ATARA

| Priority | Contract | Purpose | Beta recommendation |
| --- | --- | --- | --- |
| P0 | `AtaraVaultFactory` | Deploy isolated group Vaults | Build for Sepolia |
| P0 | `AtaraGroupVault` | Tontine contributions, locks, approvals, payouts | Build for Sepolia |
| P0 | `VaultApprovalVerifier` | EIP-712 and ERC-1271 unanimous approvals | Build with the Vault |
| P1 | `PersonalSavingsLock` | Individual savings locked until a chosen date | Useful, simpler pilot |
| P1 | `PaymentEscrow` | Hold a payment until both parties confirm delivery or cancellation | Build only with dispute rules |
| P1 | `SplitPaymentRouter` | Atomically split one payment between several recipients | Useful for groups and merchants |
| P1 | `SpendingLimitModule` | Daily limits and approved-token rules for ATARA smart accounts | Strong safety improvement |
| P1 | `GuardianRecoveryModule` | Recover a smart account after key loss | Important before Vault mainnet |
| P2 | `SubscriptionAllowance` | Capped recurring payments that users can revoke | Requires careful allowance UX |
| P2 | `MerchantEscrow` | Payment, refund window, and merchant settlement | Later merchant feature |
| P2 | `BatchPaymentRouter` | Send several transfers in one atomic operation | Useful for payroll or group payouts |
| Later | `YieldVaultAdapter` | Optional integration with audited ERC-4626 yield Vaults | Exclude from the first beta |

## Recommended delivery order

1. Finalize the recovery rule and whether the first release is a shared savings pot or a rotating tontine.
2. Build a frontend-only clickable flow and backend data model with no real custody.
3. Implement `PersonalSavingsLock` as the smallest contract and testing pilot.
4. Implement `AtaraVaultFactory`, `AtaraGroupVault`, and `VaultApprovalVerifier`.
5. Integrate Sepolia deposits, approvals, status events, and transaction recovery.
6. Run adversarial tests and a closed five-wallet beta.
7. Obtain external legal and smart-contract security review before mainnet.

## Reference standards

- EIP-712 typed structured data: https://eips.ethereum.org/EIPS/eip-712
- ERC-1271 contract signatures: https://eips.ethereum.org/EIPS/eip-1271
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/5.x/
- Safe smart-account multisignature flow: https://docs.safe.global/sdk/starter-kit
