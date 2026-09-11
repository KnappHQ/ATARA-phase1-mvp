# ATARA — Store Beta Release Playbook

Date: 7 September 2026
Target: iOS TestFlight + Google Play Internal testing
Branch: `release/store-beta` (cut from `main` after CI is green)

## Fastest safe distribution path

The first store beta should remain on Base Sepolia with test assets. Do not market the build as a production financial service and do not enable mainnet payment requests until staging and independent review are complete.

- iOS: store-signed build uploaded to App Store Connect and distributed with TestFlight.
- Android: Android App Bundle uploaded to Google Play Internal testing.
- EAS profile: `beta`.
- Application id: `com.atara.app` on iOS and Android.
- Display name: `ATARA`.

## Required EAS environment variables

`frontend/scripts/release-preflight.cjs` is the authority on what a beta build
requires — it runs in CI and fails the build. This list is a reading aid; when
the two disagree, the script is right.

Set these on the EAS project before starting a beta build:

- `EXPO_PUBLIC_API_URL` — public HTTPS backend origin, without `/api/v1`. The
  preflight also rejects credentials in the URL, a query string, and localhost.
- `EXPO_PUBLIC_PRIVY_APP_ID`
- `EXPO_PUBLIC_PRIVY_CLIENT_ID` — must differ from the app id; the preflight
  refuses the two being equal, and refuses placeholder values.
- `EXPO_PUBLIC_ALCHEMY_API_KEY`
- `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID`
- `EXPO_PUBLIC_PASSKEY_RP_ID` — **required** for beta, since passkey is a primary
  sign-in path. A bare hostname, no `https://`. See the domain-association
  condition below.
- `EXPO_PUBLIC_VAULT_FACTORY_ADDRESS` is **not** required while the Vault is
  disabled. If set, it must still be a valid non-zero address.
- Canonical product domain: `https://atara.finance`.
- The existing website remains on `https://atara.finance`; the Render API and passkey relying party use `https://api.atara.finance`.
- Set `EXPO_PUBLIC_PASSKEY_RP_ID=api.atara.finance` only after both domain-association URLs below return HTTP 200 directly (without redirects):
  - `https://api.atara.finance/.well-known/apple-app-site-association`
  - `https://api.atara.finance/.well-known/assetlinks.json`
- Configure `APPLE_TEAM_ID` on the domain backend from Apple Developer membership details.
- Configure `ANDROID_SHA256_CERT_FINGERPRINTS` from the signing certificate, add the same SHA-256 fingerprint to Privy's Android key hashes, and whitelist `com.atara.app` in Reown for both iOS and Android.
- `EXPO_PUBLIC_REOWN_PROJECT_ID` — required for wallet-only sign-in. The preflight
  wants 32 hexadecimal characters.
- `EXPO_PUBLIC_ENABLE_VAULTS=false` — mandatory for this beta and for preview;
  the preflight refuses the build otherwise.
- `EXPO_PUBLIC_SENTRY_DSN` optional but recommended for beta diagnostics.

The `beta` profile forces, and the preflight verifies:

- `EXPO_PUBLIC_NETWORK=base-sepolia` (`base-mainnet` only on the `production`
  profile, which the preflight blocks outright).
- `EXPO_PUBLIC_DEMO_MODE=false` — any distributed build is refused otherwise.
- SMS backup off.
- Store distribution.
- Android AAB.
- Automatic native build-number/version-code increments.

`EXPO_PUBLIC_SOURCE_URL` is optional; when set it must be a public HTTPS URL.

## Required backend environment variables

At minimum:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `ALCHEMY_API_KEY`
- `ALCHEMY_NETWORK=base-sepolia`
- `PUBLIC_PAYMENT_ORIGIN` — same public HTTPS backend origin, `https://api.atara.finance`.
  Without it the service falls back to `RENDER_EXTERNAL_URL`, so payment links
  carry the `onrender.com` host and the self-origin the CORS allow-list accepts
  stops matching the origin that serves the payment page.
- `APPLE_TEAM_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` — the domain-association
  files answer 503 until both are set, and passkey sign-in fails without them.
- `BASE_SEPOLIA_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- `ENABLE_MAINNET_PAYMENT_REQUESTS=false`
- MoonPay sandbox variables only if the sandbox widget is exposed in this beta.

Run the PostgreSQL migrations, Prisma generation and backend build before declaring the API ready.

## Public store URLs

Once the backend is deployed at `https://<backend-origin>`, these endpoints are ready:

- Privacy policy: `https://<backend-origin>/api/v1/legal/privacy`
- Terms: `https://<backend-origin>/api/v1/legal/terms`
- Account deletion: `https://<backend-origin>/api/v1/legal/account-deletion`
- Public health: `https://<backend-origin>/api/v1/health/backend`
- Database health: `https://<backend-origin>/api/v1/health/db` (authenticated)

`/health/backend` is what `healthCheckPath` in `render.yaml` probes, and it
touches no database. A 401 from `/health/db` means the route is protected, not
that the service is down.

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
ATARA is a self-custodial crypto payment app designed to make blockchain payments easier between people and groups. The beta includes username-based transfers, group expenses, payment requests and self-custodial wallet flows. Vault is intentionally not exposed in this beta. The first beta uses Base Sepolia and test assets while the payment and recovery flows are validated.

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

## Go/no-go checks before the first store upload

- CI green on the exact commit being built.
- `GET /api/v1/health/backend` answers 200 over HTTPS.
- The deployed API is built from the branch you actually merged into. `render.yaml`
  pins `branch:` — confirm it points at the branch carrying the code this build
  expects, or the app will talk to an API that predates its endpoints.
- Database migrations applied to the staging database.
- Registration/login works with the real Privy mobile client: passkey, Apple, Google and external-wallet paths tested.
- Reown allows `https://atara.finance` and `com.atara.app` on iOS + Android.
- Smart-account ownership verification works server-side.
- Alchemy gas policy configured and capped for testnet.
- Vault stays disabled: `EXPO_PUBLIC_ENABLE_VAULTS=false`, no Vault entry in the
  app, and the Vault routes refuse direct navigation. No factory deployment is
  required for this beta.
- Both domain-association URLs return 200 directly from
  `https://api.atara.finance`, without redirects — passkey sign-in depends on it:
  `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`.
  They answer 503 when `APPLE_TEAM_ID` or `ANDROID_SHA256_CERT_FINGERPRINTS` is
  unset on the backend.
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
- Expo/EAS project ownership: `app.json` identifies the owner as `tk41s-team` and project ID `b454eaa9-f1d5-4d8c-ac09-945ce1f1d09f`. Keep Apple/Google store credentials attached to that ATARA-managed Expo project, and make sure the `EXPO_TOKEN` repository secret belongs to that account.
- Public production/staging hosting and secrets must be configured in the selected hosting provider.
- `PUBLIC_PAYMENT_ORIGIN` is not declared in `render.yaml`, so the service falls
  back to `RENDER_EXTERNAL_URL`. Payment links would then carry the
  `onrender.com` host rather than `api.atara.finance`, and the self-origin the
  CORS allow-list accepts would not match the origin serving the payment page.
  Set it explicitly to `https://api.atara.finance`.
- The EAS project variables (`EXPO_PUBLIC_PRIVY_APP_ID`,
  `EXPO_PUBLIC_PRIVY_CLIENT_ID`, `EXPO_PUBLIC_ALCHEMY_API_KEY`,
  `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID`) live in the project's `production`
  environment, not in `eas.json`. They cannot be reviewed from the repository —
  confirm them in the EAS dashboard before starting a build.

Do not move to mainnet or public production release just because TestFlight/Internal testing accepts the binary.
