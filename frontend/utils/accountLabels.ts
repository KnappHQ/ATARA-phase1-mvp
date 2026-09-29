/**
 * Names for the accounts on this phone.
 *
 * Two different names exist and must not be confused:
 *  - the private name of an account on this phone, chosen by its owner. It is
 *    also the label handed to iOS when the passkey is created, which is what
 *    iOS then lists in its passkey picker and in Settings > Passwords. It is
 *    never sent to ATARA or to Privy;
 *  - the public identity: the @handle and the account name other ATARA users
 *    can see. Those live on the ATARA server.
 *
 * A name is only ever a label for a person to read. Which account, credential
 * or wallet something belongs to is decided by stable identifiers (see
 * accountRegistry.ts), never by comparing names.
 */

export const MAX_ACCOUNT_LABEL_LENGTH = 40;

/** Without 0, O, 1, I and L: a code read off a screen must not be ambiguous. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ACCOUNT_CODE_LENGTH = 4;

// Control characters, zero-width characters and bidirectional overrides. An
// override such as U+202E can make one label read as another in a list.
const INVISIBLE =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

/**
 * Unicode normalization where the JavaScript engine has it. Without it the text
 * is left as it is: names are then compared less leniently, never refused.
 */
const normalizeText = (input: string, form: "NFC" | "NFD"): string => {
  try {
    return typeof input.normalize === "function" ? input.normalize(form) : input;
  } catch {
    return input;
  }
};

/** Printable and single-spaced. A tab or a newline becomes a space, not nothing. */
const clean = (input: string): string =>
  normalizeText(input, "NFC")
    .replace(/\s+/g, " ")
    .replace(INVISIBLE, "")
    .replace(/\s+/g, " ")
    .trim();

/** What is stored and handed to iOS: printable, single-spaced, bounded. */
export const normalizeAccountLabel = (input: string): string =>
  clean(input).slice(0, MAX_ACCOUNT_LABEL_LENGTH).trim();

/** What two labels are compared on: "Tanguy — Tests" equals "tanguy — tests". */
export const comparableLabel = (input: string): string =>
  normalizeText(normalizeAccountLabel(input), "NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase();

/**
 * The name every passkey created before names existed carries in iOS. A new
 * account given the same name would be as hard to pick out as the old ones.
 */
export const LEGACY_PASSKEY_NAME = "ATARA";

export type LabelCheck =
  | { ok: true; label: string }
  | { ok: false; reason: "empty" | "too-long" | "duplicate" | "reserved"; label: string };

/**
 * `others` are the labels already in use on this phone, without the one being
 * edited. A duplicate is refused because two identical entries in the iOS
 * picker are exactly the problem this exists to solve.
 */
export const checkAccountLabel = (
  input: string,
  others: readonly string[],
): LabelCheck => {
  const cleaned = clean(input);
  if (!cleaned) return { ok: false, reason: "empty", label: "" };
  if (cleaned.length > MAX_ACCOUNT_LABEL_LENGTH) {
    return { ok: false, reason: "too-long", label: normalizeAccountLabel(cleaned) };
  }
  const label = normalizeAccountLabel(cleaned);
  const wanted = comparableLabel(label);
  if (wanted === comparableLabel(LEGACY_PASSKEY_NAME)) return { ok: false, reason: "reserved", label };
  if (others.some((other) => comparableLabel(other) === wanted)) {
    return { ok: false, reason: "duplicate", label };
  }
  return { ok: true, label };
};

export const LABEL_ERROR_TEXT: Record<
  Extract<LabelCheck, { ok: false }>["reason"],
  string
> = {
  empty: "Choose a name.",
  "too-long": `Use at most ${MAX_ACCOUNT_LABEL_LENGTH} characters.`,
  duplicate: "Another account on this iPhone already has this name.",
  reserved: "iOS already lists older passkeys as “ATARA”. Choose a name that tells this account apart.",
};

/** A short code from random bytes, so two suggestions never collide by habit. */
export const accountCodeFromBytes = (bytes: ArrayLike<number>): string => {
  let code = "";
  for (let i = 0; i < ACCOUNT_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[(bytes[i] ?? 0) % CODE_ALPHABET.length];
  }
  return code;
};

/**
 * The name proposed when someone has not chosen one: the @handle if it exists
 * (it is unique across ATARA), otherwise "Account" and a short code.
 */
export const suggestAccountLabel = ({
  handle,
  taken,
  bytes,
}: {
  handle?: string | null;
  taken: readonly string[];
  bytes: ArrayLike<number>;
}): string => {
  const base = handle ? `@${handle.replace(/^@/, "")}` : `Account ${accountCodeFromBytes(bytes)}`;
  const used = new Set(taken.map(comparableLabel));
  const first = normalizeAccountLabel(base);
  if (!used.has(comparableLabel(first))) return first;
  for (let n = 2; n < 100; n++) {
    const candidate = normalizeAccountLabel(`${base} ${n}`);
    if (!used.has(comparableLabel(candidate))) return candidate;
  }
  return first;
};

/**
 * The name proposed for an extra passkey of an account: the account's own name
 * and a number, unused by any account or passkey on this phone.
 */
export const suggestPasskeyName = (accountLabel: string, taken: readonly string[]): string => {
  const used = new Set(taken.map(comparableLabel));
  for (let n = 2; n < 100; n++) {
    const candidate = normalizeAccountLabel(`${accountLabel} · ${n}`);
    if (!used.has(comparableLabel(candidate))) return candidate;
  }
  return normalizeAccountLabel(accountLabel);
};

/** "0x1234…abcd", or nothing when the address is not known yet. */
export const shortAddress = (address?: string | null): string =>
  address && address.length >= 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address ?? "";
