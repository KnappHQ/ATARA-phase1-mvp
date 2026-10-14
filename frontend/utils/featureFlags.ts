/**
 * Card purchase (MoonPay). Off unless EXPO_PUBLIC_ENABLE_CARD_PURCHASE is exactly "true".
 * EXPO_PUBLIC_ONRAMP_PROVIDER is not read anywhere and must not be used as this switch.
 */
export const CARD_PURCHASE_ENABLED = process.env.EXPO_PUBLIC_ENABLE_CARD_PURCHASE === "true";
