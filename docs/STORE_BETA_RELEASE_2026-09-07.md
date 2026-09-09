# ATARA — Store Beta Release Playbook

Date: 7 September 2026
Target: iOS TestFlight + Google Play Internal testing
Branch: `codex/atara-vault`

## Fastest safe distribution path

The first store beta should remain on Base Sepolia with test assets. Do not market the build as a production financial service and do not enable mainnet payment requests until staging and independent review are complete.

- iOS: store-signed build uploaded to App Store Connect and distributed with TestFlight.
- Android: Android App Bundle uploaded to Google Play Internal testing.
- EAS profile: `beta`.
- Application id: `com.atara.app` on iOS and Android.
- Display name: `ATARA`.

## Required EAS environment variables

Set these on the EAS project before starting a beta build:

- `EXPO_PUBLIC_API_URL` — public HTTPS backend origin, without `/api/v1`.
- `EXPO_PUBLIC_PRIVY_APP_ID`
- `EXPO_PUBLIC_PRIVY_CLIENT_ID`
- `EXPO_PUBLIC_ALCHEMY_API_KEY`
- `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID`
- `EXPO_PUBLIC_VAULT_FACTORY_ADDRESS` after deploying the reviewed Sepolia factory.
- `EXPO_PUBLIC_PASSKEY_RP_ID` only after the domain publishes the correct AASA/assetlinks configuration.
- `EXPO_PUBLIC_SENTRY_DSN` optional but recommended for beta diagnostics.

The `beta` profile forces:

- Base Sepolia.
- Demo mode off.
- SMS backup off.
- Store distribution.
- Android AAB.
- Automatic native build-number/version-code increments.

## Required backend environment variables

At minimum:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `ALCHEMY_API_KEY`
- `ALCHEMY_NETWORK=base-sepolia`
- `PUBLIC_PAYMENT_ORIGIN` — same public HTTPS backend origin.
- `VAULT_FACTORY_ADDRESS`
- `VAULT_RPC_URL=https://sepolia.base.org`
- `BASE_SEPOLIA_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- `ENABLE_MAINNET_PAYMENT_REQUESTS=false`
- MoonPay sandbox variables only if the sandbox widget is exposed in this beta.

Run the PostgreSQL migrations, Prisma generation and backend build before declaring the API ready.

## Public store URLs

Once the backend is deployed at `https://<backend-origin>`, these endpoints are ready:

- Privacy policy: `https://<backend-origin>/api/v1/legal/privacy`
- Terms: `https://<backend-origin>/api/v1/legal/terms`
- Account deletion: `https://<backend-origin>/api/v1/legal/account-deletion`
- Health: `https://<backend-origin>/api/v1/health/backend`

`/api/v1/health/backend` is the public liveness probe — it is what
`healthCheckPath` in `render.yaml` points at, and it touches no database.
`/api/v1/health/db` exists too but **requires a bearer token**: it runs a query
on every call, so leaving it open let anyone drain the connection pool. A 401
there means the route is protected, not that the service is down.

Company identity used in the app and pages:

- ATARA LTD
- Company number 17054670
- 71-75 Shelton Street, Covent Garden, London, United Kingdom, WC2H 9JQ
- privacy@atara.finance
- support@atara.finance

## Suggested store metadata

### Name
ATARA

### Subtitle / short description
Send, split and organize crypto payments.

### Beta description
ATARA is a self-custodial crypto payment app designed to make blockchain payments easier between people and groups. The beta includes username-based transfers, group expenses, payment requests and shared Vault experiments. The first beta uses Base Sepolia and test assets while the payment and recovery flows are validated.

### Keywords / positioning
crypto wallet, payments, split expenses, groups, USDC, Base, self custody

### Reviewer note
This is a beta build using Base Sepolia. Test balances and test tokens have no monetary value. The app does not claim to issue a payment card. Some third-party onboarding/on-ramp functionality may remain sandboxed or disabled. Account deletion is available in Profile.

## Apple App Store Connect

Before upload/submission:

1. Confirm the Apple Developer team owns/accepts `com.atara.app` or change the bundle identifier before the first uploaded build.
2. Configure Sign in with Apple / OAuth capabilities required by Privy.
3. Configure passkey associated domains only when the AASA domain is live.
4. Complete App Privacy answers based on actual enabled services. Passive PostHog analytics is disabled in the current beta. Sentry is configured without default PII.
5. Supply the public privacy-policy URL.
6. Provide export-compliance answers based on the final binary and cryptography use; do not guess these answers.
7. Upload the beta build with `eas build --profile beta --platform ios --auto-submit` or build then `eas submit --profile beta --platform ios`.
8. Start with internal TestFlight testers. External testers require Apple's beta review.

## Google Play Console

Before upload/submission:

1. Confirm the Play app package is `com.atara.app` before the first release. Package names cannot be freely changed after publication.
2. Complete Data safety using the final enabled services and real backend behavior.
3. Set the privacy-policy URL.
4. Set the account-deletion URL to `/api/v1/legal/account-deletion`.
5. Complete the financial-features / blockchain-content declarations accurately for a self-custodial crypto wallet beta.
6. Upload with `eas build --profile beta --platform android --auto-submit` or build then `eas submit --profile beta --platform android`.
7. `submit.beta.android.track` is configured for `internal`.
8. `submit.beta.ios` is still an empty object in `eas.json`. `store-beta.yml`
   submits with `--auto-submit --non-interactive`, which cannot prompt, so the
   App Store Connect app identifier has to be configured — either as `ascAppId`
   under `submit.beta.ios` or on the EAS project — before the first iOS upload.

## Go/no-go checks before the first store upload

- CI green on the exact commit being built.
- `GET /api/v1/health/backend` answers 200 over HTTPS.
- Database migrations applied to the staging database.
- Registration/login works with real Privy credentials.
- Smart-account ownership verification works server-side.
- Alchemy gas policy configured and capped for testnet.
- New reviewed Vault factory deployed to Base Sepolia and address set in backend + frontend.
- Send USDC test transfer succeeds on two physical devices/accounts.
- Group split accept/dispute and settlement verified end to end.
- Payment request link opens from a second device/browser and receipt reconciliation succeeds.
- Account deletion succeeds and user cannot log back into the deleted ATARA backend account without registering again.
- Privacy, Terms and account-deletion public pages return 200 over HTTPS.
- App icon and splash screen render correctly on physical iOS and Android devices.
- No fake card, guaranteed fee, guaranteed recovery, no-KYC promise, or mainnet claim appears in the store listing.

## Current external blockers

The repository alone cannot complete these account-side operations:

- Apple signing/App Store Connect authentication and agreements.
- Google Play Console service-account/authentication and required declarations.
- Expo/EAS project ownership: `app.json` currently identifies the Expo owner as `karankoder`. Keep this only if that account is intentionally managing ATARA builds and has the correct Apple/Google credentials. Prefer transferring the EAS project into an ATARA Expo Organization for long-term ownership.
- Public production/staging hosting and secrets must be configured in the selected hosting provider.

Do not move to mainnet or public production release just because TestFlight/Internal testing accepts the binary.
