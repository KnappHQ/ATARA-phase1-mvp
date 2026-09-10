# Sovereignty and security review

Date: 9 September 2026  
Scope: mobile authentication/signing, backend authentication boundary, provider dependencies, user-facing custody claims, release configuration, dependency audit, and open-source readiness.

## Outcome

The beta can accurately describe its payment account as user-authorized and self-custodial: backend login and registration are bound to a nonce challenge signed by the owner address, and the backend verifies that the claimed Alchemy smart account derives from that signer. The whole application is not yet decentralized because social data, sessions, provider routing and embedded key infrastructure still have central operators.

The new wallet-only path removes Google/Apple as mandatory roots of identity. It does not remove the ATARA API from handles, contacts, groups or sessions, and it does not remove Reown/Alchemy from the current mobile route.

## Changes made in this branch

- Added distinct passkey sign-up and passkey login paths.
- Added external EVM wallet connection using Reown AppKit/WalletConnect.
- Reused the existing strict ATARA challenge and signer-to-smart-account ownership verification for wallet-only accounts.
- Allowed a valid ATARA API session to restore read access without requiring a live Privy OAuth session.
- Required the matching external wallet before building a transaction signer for wallet-only accounts.
- Added allowed authentication-provider validation to the registration API.
- Added a Security Center signing-method status and a sovereignty/transparency screen.
- Updated privacy, terms, logout and README claims so the app does not call every layer decentralized.
- Disabled Reown analytics and namespaced its persisted connection data away from other ATARA state.
- Added release validation for optional passkey domain, Reown project and public source URL configuration.

## Verification performed

- Frontend ESLint: passed.
- Frontend TypeScript: passed.
- Expo dependency compatibility check: passed.
- iOS and Android JavaScript/Hermes export: passed.
- Backend TypeScript build: passed.
- Backend tests: 45 passed, 1 database integration test skipped because `TEST_DATABASE_URL` was not supplied.
- Release-preflight tests: 4 passed.
- Diff secret scan: no private keys or known live/test secret patterns found.

## Blocking before a real-value/mainnet launch

1. Configure and physically test Privy's exact native client, `com.atara.app` allowlist, `atara` URL scheme, and the passkey associated-domain files.
2. Create the Reown project, set `EXPO_PUBLIC_REOWN_PROJECT_ID`, then test connection, rejection, cancellation, reconnect, logout and account/network switching with at least two wallets on iOS and Android.
3. Design and verify signer rotation, loss recovery and provider migration. Wallet ownership without a proven escape/recovery path is not sufficient sovereignty.
4. Add a second RPC/bundler route and demonstrate user-paid gas fallback when Alchemy sponsorship or APIs fail.
5. Independently review smart-account ownership derivation and Vault create/invite/exit/delete/refund behavior before accepting real value.
6. Resolve dependency audit findings that currently require coordinated major upgrades. These include the ethers v5 `elliptic` chain and high-severity advisories inside the current Expo/Metro and Prisma toolchains. `npm audit fix --force` must not be used blindly because it proposes breaking framework downgrades/upgrades.
7. Complete the financial/crypto, privacy and regional store disclosures for every target market.

## Open-source readiness

The backend package metadata currently says `MIT`, but the repository has no root `LICENSE` file defining the scope for the mobile app, contracts, backend and documentation. Do not advertise the complete project as open source until ATARA LTD deliberately selects the licence, adds the root licence text, makes the intended repository public, and publishes contribution/reproducible-build instructions.

The recommended default for fastest integrations is Apache-2.0 with ATARA trademarks reserved separately. The recommended alternative for reciprocal hosted infrastructure is AGPL-3.0. This is a product/legal decision, not a routine engineering default.

## Residual centralization map

| Component | Operator today | Failure effect | Required exit path |
| --- | --- | --- | --- |
| Embedded signer/passkey | Privy | New embedded sessions and recovery may fail | signer export/rotation and documented migration |
| External wallet discovery | Reown/WalletConnect | In-app discovery/connection may fail | direct provider or alternate connector |
| Smart account/RPC/bundler/paymaster | Alchemy | account operations or sponsored gas may fail | second provider and user-paid transaction route |
| Handles/contacts/groups/activity API | ATARA | social discovery and metadata unavailable | signed export plus self-hostable/federated indexer |
| PostgreSQL/session service | ATARA hosting | API login/session unavailable | wallet-verifiable portable social events |
| Base network/contracts | decentralized network plus deployed contracts | chain conditions and contract risk remain | published addresses, audits and contract-level exits |

