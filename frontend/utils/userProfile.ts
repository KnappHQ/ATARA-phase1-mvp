export interface UserProfile {
  id: string;
  handle: string;
  smartAccountAddress: string;
  displayName?: string;
  email?: string;
  profilePicUrl?: string;
  authProvider?: string;
}

const optional = (value: unknown) =>
  typeof value === "string" && value ? value : undefined;

/**
 * Keeps only what the app shows about its own account.
 *
 * Older backends answered sign-in with the whole database row (legacy TOTP
 * fields, the recovery phone, the signer address), and the app saved whatever
 * it received on the phone. Whatever the server sends, only these fields are
 * kept in memory and in secure storage.
 */
export const toUserProfile = (raw: Record<string, unknown>): UserProfile => {
  const profile: UserProfile = {
    id: String(raw.id ?? ""),
    handle: String(raw.handle ?? ""),
    smartAccountAddress: String(raw.smartAccountAddress ?? ""),
  };
  const displayName = optional(raw.displayName);
  const email = optional(raw.email);
  const profilePicUrl = optional(raw.profilePicUrl);
  const authProvider = optional(raw.authProvider);
  if (displayName) profile.displayName = displayName;
  if (email) profile.email = email;
  if (profilePicUrl) profile.profilePicUrl = profilePicUrl;
  if (authProvider) profile.authProvider = authProvider;
  return profile;
};
