import { ErrorHandler } from "./errorHandler";

/**
 * Validation for the values a user can write about themselves.
 *
 * `PATCH /user/me` previously wrote `handle`, `email`, `profilePicUrl` and
 * `displayName` straight to the database with only a uniqueness check. That had
 * three consequences worth naming, because they are why this file exists:
 *
 * - the handle escaped the rules registration enforces, which is what loaded
 *   the HTML injection in the feedback email;
 * - registration lowercases handles and `getUserByHandle` looks them up
 *   lowercased, but the update stored them verbatim - so a handle set to
 *   "Alice" became unreachable;
 * - `profilePicUrl` accepted `javascript:` and `data:` URLs, stored and later
 *   rendered by the app.
 *
 * These functions are pure, so they are tested directly.
 */

const HANDLE_PATTERN = /^[a-z0-9_]+$/;
const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 20;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

const PROFILE_PIC_URL_MAX_LENGTH = 2048;

const DISPLAY_NAME_MAX_LENGTH = 50;
/** C0 and C1 control characters: they break downstream rendering. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== "string") {
    throw new ErrorHandler(`${label} must be text`, 400);
  }
  return value;
};

/**
 * The single definition of a valid handle in the backend.
 *
 * Registration and profile update both go through this, so the two can no
 * longer drift apart. Returns the canonical (lowercase) form to store.
 */
export const normalizeHandle = (value: unknown): string => {
  const handle = requireString(value, "Handle").trim().toLowerCase();

  if (handle.length < HANDLE_MIN_LENGTH || handle.length > HANDLE_MAX_LENGTH) {
    throw new ErrorHandler(
      `Handle must be between ${HANDLE_MIN_LENGTH} and ${HANDLE_MAX_LENGTH} characters`,
      400,
    );
  }

  if (!HANDLE_PATTERN.test(handle)) {
    throw new ErrorHandler(
      "Handle can only contain lowercase letters, numbers, and underscores",
      400,
    );
  }

  return handle;
};

export const normalizeEmail = (value: unknown): string => {
  const email = requireString(value, "Email").trim().toLowerCase();

  if (email.length > EMAIL_MAX_LENGTH) {
    throw new ErrorHandler("Email is too long", 400);
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new ErrorHandler("Please provide a valid email address", 400);
  }

  return email;
};

/**
 * Only absolute https URLs are accepted.
 *
 * Anything else - `javascript:`, `data:`, plain `http:` - is refused rather
 * than stored, because this value is rendered by the app.
 */
export const normalizeProfilePicUrl = (value: unknown): string => {
  const raw = requireString(value, "Profile picture URL").trim();

  if (raw.length > PROFILE_PIC_URL_MAX_LENGTH) {
    throw new ErrorHandler("Profile picture URL is too long", 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ErrorHandler("Profile picture URL must be a valid URL", 400);
  }

  if (parsed.protocol !== "https:") {
    throw new ErrorHandler("Profile picture URL must use https", 400);
  }

  return raw;
};

export const normalizeDisplayName = (value: unknown): string => {
  const displayName = requireString(value, "Display name").trim();

  if (!displayName) {
    throw new ErrorHandler("Display name cannot be empty", 400);
  }

  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new ErrorHandler(
      `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`,
      400,
    );
  }

  if (CONTROL_CHARACTERS.test(displayName)) {
    throw new ErrorHandler("Display name contains invalid characters", 400);
  }

  return displayName;
};
