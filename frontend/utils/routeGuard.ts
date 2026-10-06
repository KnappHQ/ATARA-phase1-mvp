/**
 * Which routes the root layout lets a signed-in person stay on.
 *
 * The layout redirects an authenticated user to the tabs whenever the current
 * route is not in PROTECTED_ROUTES, and while it redirects it draws nothing but
 * a black spinner. A screen that exists as a file in `app/` but is missing from
 * this list therefore opens as a black screen and bounces back: exactly how
 * "Plans & Miles" and "ATARA Card" shipped. Every new top-level route has to be
 * added here, and scripts/route-guard.test.cjs fails if one is not.
 */

/** The onboarding flow: reachable only while signed out. */
export const AUTH_ROUTES = ["onboarding", "oauth-callback"] as const;

/** Reachable only while signed in. */
export const PROTECTED_ROUTES = [
  "(tabs)",
  "send",
  "transaction-success",
  "transaction-detail",
  "contact-detail",
  "group-create",
  "group-details",
  "add-crypto",
  "pay-merchant",
  "security",
  "manage-accounts",
  "sign-in-methods",
  "sovereignty",
  "plans",
  "card",
  "blocked-users",
  "vault-create",
  "vault-detail",
] as const;

export type RouteRedirect = "onboarding" | "tabs" | null;

export const decideRedirect = (input: {
  route: string | undefined;
  isReady: boolean;
  isFullyAuthenticated: boolean;
}): RouteRedirect => {
  const { route, isReady, isFullyAuthenticated } = input;
  if (!isReady) return null;
  const isAuthRoute = (AUTH_ROUTES as readonly string[]).includes(route ?? "");
  if (!isFullyAuthenticated) return isAuthRoute ? null : "onboarding";
  const isProtected = (PROTECTED_ROUTES as readonly string[]).includes(route ?? "");
  return isAuthRoute || !isProtected ? "tabs" : null;
};
