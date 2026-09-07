# ATARA — Expo/EAS ownership transfer checklist

## Current state

- EAS project slug: `atara-prod`
- EAS project ID: `349e8195-b371-4294-9bab-c85f991b11be`
- Current Expo owner in `frontend/app.json`: `karankoder`
- Intended business owner: an Expo Organization controlled by ATARA LTD / Tanguy
- Karan remains a Developer (or Admin if needed), not the sole project owner.

## Required transfer

1. Tanguy signs in to Expo with his own account and creates/uses an ATARA-owned Organization.
2. Tanguy invites Karan to that Organization. Developer is sufficient for builds, updates and credentials; Admin can be used if broader project administration is needed.
3. Karan must be Owner/Admin on the current source account and Owner/Admin on the destination Organization for the transfer operation.
4. In Expo Project settings > General, transfer `atara-prod` to the ATARA-owned Organization.
5. Keep the existing EAS project ID unless Expo explicitly changes it during the supported transfer flow.
6. After transfer, update `frontend/app.json` `expo.owner` to the exact ATARA Organization slug.
7. Create a new Expo personal access token from an ATARA-controlled account and store it in GitHub Actions as `EXPO_TOKEN`.
8. Re-run the Store Beta workflow only after the Vault factory is deployed and configured.

## Release guard

The Store Beta workflow intentionally fails while `expo.owner` is still `karankoder` or while `EXPO_PUBLIC_VAULT_FACTORY_ADDRESS` is missing/invalid. This prevents an App Store / Google Play beta from being published under incomplete infrastructure ownership.

## Security

Do not share Expo passwords, Apple credentials, Google passwords, wallet seed phrases or deployment private keys in chat or source control. Use account invitations and secret stores.
