# ATARA — subscription foundation

## Decision captured

ATARA will support a future premium subscription (working label: ATARA+). The exact paid benefits, pricing and commercial package are intentionally **not** fixed yet.

## What is implemented now

The backend has a provider-neutral entitlement state on the user profile:

- `subscriptionTier`: `FREE` or `PREMIUM`
- `subscriptionStatus`: `INACTIVE`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `CANCELED`, `EXPIRED`
- optional provider/product identifiers
- optional entitlement expiry date

All existing users default to `FREE` + `INACTIVE`. No feature is currently paywalled and no payment is charged by this implementation.

## Product rule

ATARA's core wallet experience must remain useful without a subscription. The premium plan should add convenience, limits, advanced features or partner value rather than removing essential wallet functionality.

## Before activation

1. Define the exact premium benefits and free/premium boundary.
2. Define monthly/annual pricing and target economics.
3. Select the billing path(s) for iOS, Android and any eligible web purchase flow.
4. Add server-side purchase verification / webhook handling for the selected provider(s).
5. Make provider events idempotent and map them to the entitlement state above.
6. Add restore-purchase, cancellation/grace-period UX and support tooling.
7. Add tests proving that paid entitlements cannot be granted by modifying the mobile client.

No subscription provider is trusted yet and no client endpoint can directly promote an account to PREMIUM.
