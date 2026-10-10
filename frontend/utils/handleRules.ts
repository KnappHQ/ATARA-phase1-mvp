/**
 * The @handle rules, shown to the person before they type a wrong one.
 *
 * These values mirror `backend/utils/profileValidation.ts` (3 to 20 characters,
 * lowercase letters, numbers and underscore). A test reads that file, so the
 * two cannot drift apart.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

export const HANDLE_RULES_TEXT = `${HANDLE_MIN} to ${HANDLE_MAX} characters. Lowercase letters, numbers and _ only.`;
export const HANDLE_STRIPPED_TEXT = "Only lowercase letters, numbers and _ work in a @handle.";
export const HANDLE_FIXED_TEXT =
  "You can't change your @handle in the app yet, so pick one you're happy to share.";

/** Lowercase, drop everything that is not a-z, 0-9 or _, and cap the length. */
export const sanitizeHandle = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, HANDLE_MAX);

/** True when typing `text` lost something other than letter case or the length cap. */
export const strippedCharacters = (text: string): boolean =>
  text.toLowerCase().replace(/[^a-z0-9_]/g, "") !== text.toLowerCase();

export type HandleStatusKind = "too_short" | "checking" | "available" | "taken" | "error";

export interface HandleStatus {
  kind: HandleStatusKind;
  message: string;
}

export const handleStatus = ({
  handle,
  isChecking,
  isAvailable,
  error,
}: {
  handle: string;
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
}): HandleStatus | null => {
  if (handle.length < HANDLE_MIN) {
    const missing = HANDLE_MIN - handle.length;
    return {
      kind: "too_short",
      message: `Add ${missing} more character${missing === 1 ? "" : "s"}`,
    };
  }
  if (error) return { kind: "error", message: error };
  if (isChecking) return { kind: "checking", message: "Checking…" };
  if (isAvailable === true) return { kind: "available", message: `@${handle} is available` };
  if (isAvailable === false) {
    return { kind: "taken", message: `@${handle} is taken. Try another.` };
  }
  return null;
};
