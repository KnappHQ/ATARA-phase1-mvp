/**
 * Where ATARA lives on the web, and how to reach it. One place, so a link or an
 * address is never typed twice (the invite once pointed to a domain that does
 * not exist).
 */
export const DEFAULT_SITE_URL = "https://atara.finance";

/** The website, without a trailing slash. EXPO_PUBLIC_SITE_URL overrides it per build. */
export const siteUrl = (configured: string | undefined = process.env.EXPO_PUBLIC_SITE_URL): string => {
  const value = (configured ?? "").trim().replace(/\/+$/, "");
  return /^https:\/\/[^\s/]+/.test(value) ? value : DEFAULT_SITE_URL;
};

export const SITE_URL = siteUrl();

export const SUPPORT_EMAIL = "support@atara.finance";

/** The text shared by "Invite a friend". */
export const inviteMessage = (url: string = SITE_URL): string =>
  `Join me on ATARA to send and receive money instantly: ${url}`;
