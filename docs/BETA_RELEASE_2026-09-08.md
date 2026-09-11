# ATARA beta release status — 8 September 2026

## Completed in this release branch

- Claude security PRs #7 and #8 are merged into `codex/atara-vault`.
- Expo's missing MFA QR-code native dependency is installed.
- Privy and its exact native peers are updated together; Android and iOS JavaScript bundles compile.
- CI now compiles both native bundles and runs a PostgreSQL-backed deletion-integrity test.
- Account deletion anonymizes the profile and invalidates sessions without deleting shared expenses, debts, transfers or receipt replay protection.
- Entering `@` shows known contacts alphabetically; partial local matches are immediate and server search starts at three characters.
- MoonPay is explicitly sandbox-only on Base Sepolia. The beta cannot accidentally open a live checkout or claim that sandbox activity funds a test wallet.
- The Expo workflow separates signed builds from store submission, waits for results and preserves the result JSON. It can also produce an installable Android preview APK.
- The duplicate Vault deploy workflows are consolidated. A known factory is verified instead of redeployed; new deployments are checked and their receipt is preserved.
- Production remains explicitly gated to Base mainnet and cannot be published by this branch.

## Required external configuration

These values are credentials or provider-owned state and cannot be committed to Git:

- GitHub secret `EXPO_TOKEN` for the Expo organization `tk41s-team`.
- EAS environment values: `EXPO_PUBLIC_PRIVY_APP_ID`, `EXPO_PUBLIC_PRIVY_CLIENT_ID`, `EXPO_PUBLIC_ALCHEMY_API_KEY`, `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID`, and the public API URL.
- A dedicated, funded Base Sepolia deployer secret (`VAULT_DEPLOYER_PRIVATE_KEY`) if the Vault factory has not yet been deployed.
- After deployment: the public factory address in GitHub variable `VAULT_FACTORY_ADDRESS`, Render `VAULT_FACTORY_ADDRESS`, and EAS `EXPO_PUBLIC_VAULT_FACTORY_ADDRESS`.
- Apple App Store Connect and Google Play service credentials before enabling the workflow's `submit` option.

## Release sequence

1. Merge the verified release-fix PR into `codex/atara-vault`.
2. Deploy the backend migration and confirm `/api/v1/health/backend` on Render.
3. Deploy or verify the Vault factory on Base Sepolia and configure its public address.
4. Run Store Beta with profile `preview`, platform `android`, submit `false` for an installable APK.
5. Test login, passkey, MFA, send/receive, groups, account deletion and Vault on physical Android and iPhone devices.
6. Run Store Beta with profile `beta`; enable submission only after device tests and store credentials are confirmed.

## Deliberately not claimed as finished

- A Gnosis Pay/card partnership is not an implemented card product. Provider onboarding, eligibility, compliance and commercial approval remain external.
- SMS backup stays disabled until a verified provider, abuse controls and costs are configured.
- BTC, SOL and XMR displays do not create safe multichain custody or settlement. Base Sepolia USDC/ETH remains the beta scope.
- Mainnet and public store release remain blocked until device evidence, production provider configuration, legal review and a production contract review are complete.
