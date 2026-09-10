# ATARA decentralization and sovereignty roadmap

Last reviewed: 9 September 2026

## Product promise

ATARA should make self-custody usable without pretending that every supporting service is decentralized. The promise is narrower and testable:

- a payment requires authorization from the user's configured signer;
- the ATARA API does not hold a private key that can independently sign a payment;
- confirmed assets and transactions remain on the supported public chain if ATARA's social service is unavailable;
- social login is optional rather than the root of ownership;
- every remaining infrastructure dependency is disclosed and has a portability plan.

## Current beta boundary

| Capability | Current source of truth | Current dependency | Portability today |
| --- | --- | --- | --- |
| Asset ownership and transfers | Base smart account | Base plus Alchemy wallet infrastructure | Publicly inspectable on-chain; signer migration is not yet exposed in-app |
| Wallet-only login | EVM wallet signature | Reown/WalletConnect discovery plus ATARA challenge API | User retains the external wallet; ATARA session is replaceable |
| Passkey/social login | Privy embedded signer | Privy and the user's platform passkey/OAuth account | Recovery/export flow still needs production validation |
| Handles and contacts | ATARA API/PostgreSQL | ATARA-hosted service | Not portable yet |
| Group expense metadata | ATARA API/PostgreSQL | ATARA-hosted service | Not portable yet |
| Vault balances/rules | Vault contract where deployed | Base RPC plus ATARA index/read interface | On-chain state is inspectable; exit and deletion flows require contract/device evidence |
| Sponsored gas | Alchemy paymaster policy | Alchemy | User-paid fallback exists for supported transactions; multi-provider routing is not implemented |

The beta must say “self-custodial” or “wallet-only sign-in” when those claims are accurate. It must not describe the complete product as fully decentralized yet.

## Delivery phases

### Phase 1 — sovereign entry

- Make passkey creation and wallet-only sign-in more prominent than Google/Apple.
- Authenticate external wallets with a nonce-bound signature verified by the ATARA API.
- Keep Google and Apple as optional convenience/recovery methods.
- Show the signer, smart-account address, network and provider dependencies in the app.
- Keep Base Sepolia visibly marked as test-only.

### Phase 2 — recovery and provider portability

- Add a tested signer-rotation/recovery flow with time delays and explicit user confirmation.
- Add an emergency export/migration procedure supported by the chosen key provider.
- Support at least two RPC endpoints, two bundler routes and a user-paid gas fallback.
- Provide a read-only recovery interface that does not depend on the main ATARA API.
- Commission an independent smart-account and Vault security review before mainnet value.

### Phase 3 — portable social data

- Define signed, versioned events for contacts, group membership, expenses and payment requests.
- Let users export these events and verify them independently.
- Publish a self-hostable indexer/API and document federation or peer discovery.
- Minimize the central database to caching, spam controls and optional notification delivery.

### Phase 4 — verifiable open development

- Publish the repository with a deliberate licence, contribution guide, security policy and threat model.
- Produce reproducible mobile build instructions and signed release provenance.
- Publish contract addresses, ABIs, deployments and audit reports.
- Add public governance rules before using the word “protocol” for centrally controlled product decisions.

## Open-source decision

The backend package metadata currently names MIT, but the repository has no root licence defining the scope for the app, contracts, backend and documentation. Treat the repository-wide licence as unresolved and choose it deliberately before setting `EXPO_PUBLIC_SOURCE_URL` in a store build:

| Licence | Best fit | Trade-off |
| --- | --- | --- |
| Apache-2.0 | Fast ecosystem adoption and commercial integrations | Hosted forks can remain closed |
| AGPL-3.0 | Ensuring modified hosted services publish their source | Some companies will avoid integration |
| Business Source / source-available | Protecting near-term commercial exclusivity | Must not be marketed as open source |

Recommended decision process: keep the ATARA trademarks separate, obtain legal review, then choose Apache-2.0 for maximum distribution or AGPL-3.0 if reciprocal infrastructure is more important. Do not add a licence by accident through a routine code change.

## Launch blockers for real funds

- passkey associated-domain files and production Privy client are verified on physical iOS and Android devices;
- Reown project origin/redirect configuration is verified with at least two external wallets;
- loss/recovery/signer-rotation tests are recorded;
- smart-account ownership derivation and Vault exit/refund behavior are independently reviewed;
- mainnet contracts and addresses are published and monitored;
- store disclosures, privacy text, regional crypto rules and sanctions controls are reviewed for each launch market;
- no screen displays simulated or testnet balances as real money.
