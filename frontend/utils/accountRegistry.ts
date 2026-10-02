/**
 * The accounts this phone knows about.
 *
 * Everything here is stored on the phone and nowhere else: no request carries
 * this list, and no ATARA endpoint returns it. It exists so a person with
 * several accounts can recognize, rename, switch between and remove them.
 *
 * Identity rule: an account is found by its stable identifiers, the Privy user
 * id first and the ATARA user id second. A passkey belongs to an account
 * because Privy lists its credential id under that Privy user, or because this
 * app created it while that user was signed in. Labels, @handles, order and
 * dates are shown to a person; they are never used to decide which account
 * something belongs to.
 */

import {
  checkAccountLabel,
  comparableLabel,
  shortAddress,
  suggestAccountLabel,
  type LabelCheck,
} from "./accountLabels";
import { normalizeCredentialId } from "./passkeyOptions";
import type { PasskeySummary } from "./loginMethods";

export const REGISTRY_VERSION = 1;

/** A passkey Privy has not listed yet is kept this long after it was created. */
export const NEW_PASSKEY_GRACE_MS = 10 * 60 * 1000;

export interface PasskeyRecord {
  /** Normalized: base64url without padding. */
  credentialId: string;
  /**
   * The name given to iOS when this app created the passkey. null when it was
   * created before names existed or somewhere else: the app cannot read what
   * iOS calls it.
   */
  name: string | null;
  createdAt: number;
  /** The last time this phone proved the passkey works, or null if never. */
  verifiedAt: number | null;
  origin: "atara" | "existing";
}

export interface LocalAccount {
  /** Local identifier, generated once. Never shown, never derived from a name. */
  key: string;
  privyUserId: string | null;
  /** The ATARA user id. null until the profile exists. */
  userId: string | null;
  /** Cached copy of the public identity, refreshed at each sign-in. */
  handle: string | null;
  smartAccountAddress: string | null;
  /** The private name on this phone. */
  label: string;
  /** "auto" follows the @handle; "user" was chosen by the owner and is kept. */
  labelSource: "user" | "auto";
  authProvider: string | null;
  passkeys: PasskeyRecord[];
  createdAt: number;
  lastUsedAt: number;
  /**
   * When the ATARA profile was deleted from this phone. The wallet and the
   * passkeys behind it are not touched by that, so the entry stays: the person
   * can still sign in and set up a new profile for the same wallet.
   */
  profileDeletedAt: number | null;
}

export interface RegistryState {
  version: number;
  accounts: LocalAccount[];
}

/** A local identifier for a new entry: random, and not derived from anything about the account. */
export const newAccountKey = (bytes: ArrayLike<number>): string => {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += (bytes[i] & 255).toString(16).padStart(2, "0");
  return `acct_${hex}`;
};

export const emptyRegistry = (): RegistryState => ({ version: REGISTRY_VERSION, accounts: [] });

export interface Identity {
  privyUserId?: string | null;
  userId?: string | null;
}

export const findAccount = (state: RegistryState, identity: Identity): LocalAccount | undefined => {
  if (identity.privyUserId) {
    const match = state.accounts.find((account) => account.privyUserId === identity.privyUserId);
    if (match) return match;
  }
  if (identity.userId) {
    return state.accounts.find((account) => account.userId === identity.userId);
  }
  return undefined;
};

export const labelsInUse = (state: RegistryState, exceptKey?: string): string[] =>
  state.accounts.filter((account) => account.key !== exceptKey).map((account) => account.label);

/** Names already given to a passkey on this phone, whichever account owns it. */
export const passkeyNamesInUse = (state: RegistryState): string[] =>
  state.accounts.flatMap((account) =>
    account.passkeys.flatMap((passkey) => (passkey.name ? [passkey.name] : [])),
  );

export const verifiedCredentialIds = (account: LocalAccount): string[] =>
  account.passkeys.filter((passkey) => passkey.verifiedAt !== null).map((passkey) => passkey.credentialId);

const replaceAccount = (state: RegistryState, next: LocalAccount): RegistryState => ({
  ...state,
  accounts: state.accounts.map((account) => (account.key === next.key ? next : account)),
});

/** Privy reports seconds; this app stores milliseconds. */
const toMillis = (value: number | null | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? (value < 1e12 ? value * 1000 : value) : fallback;

/**
 * A passkey was just created for a brand-new Privy user. The ATARA profile does
 * not exist yet, so there is no @handle: the entry is bound to the Privy user id
 * and completed when the profile is registered.
 */
export const beginPendingAccount = (
  state: RegistryState,
  input: { key: string; privyUserId: string; label: string; credentialId: string; now: number },
): RegistryState => {
  const record: PasskeyRecord = {
    credentialId: normalizeCredentialId(input.credentialId),
    name: input.label,
    createdAt: input.now,
    verifiedAt: input.now,
    origin: "atara",
  };
  const existing = findAccount(state, { privyUserId: input.privyUserId });
  if (existing) {
    const passkeys = existing.passkeys.some((p) => p.credentialId === record.credentialId)
      ? existing.passkeys
      : [...existing.passkeys, record];
    return replaceAccount(state, { ...existing, passkeys, lastUsedAt: input.now });
  }
  return {
    ...state,
    accounts: [
      ...state.accounts,
      {
        key: input.key,
        privyUserId: input.privyUserId,
        userId: null,
        handle: null,
        smartAccountAddress: null,
        label: input.label,
        labelSource: "user",
        authProvider: "passkey",
        passkeys: [record],
        createdAt: input.now,
        lastUsedAt: input.now,
        profileDeletedAt: null,
      },
    ],
  };
};

/**
 * Brings the list of passkeys in line with what Privy reports for the user.
 * Records for credentials Privy no longer lists are dropped, except one created
 * moments ago that has not shown up yet. Credentials Privy lists that this
 * phone never saw are added as "existing": their name is unknown.
 */
export const syncPasskeys = (
  records: readonly PasskeyRecord[],
  linked: readonly PasskeySummary[],
  now: number,
): PasskeyRecord[] => {
  const linkedIds = new Set(linked.map((passkey) => passkey.credentialId));
  const kept = records.filter(
    (record) => linkedIds.has(record.credentialId) || now - record.createdAt < NEW_PASSKEY_GRACE_MS,
  );
  const known = new Set(kept.map((record) => record.credentialId));
  const added: PasskeyRecord[] = linked
    .filter((passkey) => !known.has(passkey.credentialId))
    .map((passkey) => ({
      credentialId: passkey.credentialId,
      name: null,
      createdAt: toMillis(passkey.firstVerifiedAt, now),
      verifiedAt: null,
      origin: "existing" as const,
    }));
  return [...kept, ...added];
};

export interface SignInSnapshot {
  /** Used only if a new entry has to be created. */
  key: string;
  /** Entropy for the suggested name of a new entry. */
  bytes: ArrayLike<number>;
  privyUserId?: string | null;
  userId: string | null;
  handle?: string | null;
  smartAccountAddress?: string | null;
  authProvider?: string | null;
  /** Privy's current passkeys for this user. Omit to leave the list alone. */
  passkeys?: readonly PasskeySummary[];
  /** The credential this sign-in used, when the app ran the sign-in itself. */
  usedCredentialId?: string | null;
  now: number;
}

const mergePasskeys = (primary: readonly PasskeyRecord[], other: readonly PasskeyRecord[]): PasskeyRecord[] => {
  const merged = new Map(primary.map((record) => [record.credentialId, record]));
  for (const record of other) {
    const kept = merged.get(record.credentialId);
    if (!kept) merged.set(record.credentialId, record);
    // Whichever copy knows more wins: a name given to iOS, a proof on this phone.
    else merged.set(record.credentialId, { ...kept, name: kept.name ?? record.name, verifiedAt: kept.verifiedAt ?? record.verifiedAt });
  }
  return [...merged.values()];
};

/**
 * One person can end up with two entries: one made while only the ATARA session
 * was known (no Privy user), another made when the passkey signed in. Once both
 * identifiers are known they are one account. The Privy entry stays, and takes
 * what the other knew.
 */
const mergeDuplicates = (state: RegistryState, snapshot: SignInSnapshot): RegistryState => {
  if (!snapshot.privyUserId || !snapshot.userId) return state;
  const byPrivy = state.accounts.find((account) => account.privyUserId === snapshot.privyUserId);
  const byUser = state.accounts.find((account) => account.userId === snapshot.userId);
  if (!byPrivy || !byUser || byPrivy.key === byUser.key) return state;

  const keepOtherLabel = byUser.labelSource === "user" && byPrivy.labelSource !== "user";
  const merged: LocalAccount = {
    ...byPrivy,
    userId: byPrivy.userId ?? byUser.userId,
    handle: byPrivy.handle ?? byUser.handle,
    smartAccountAddress: byPrivy.smartAccountAddress ?? byUser.smartAccountAddress,
    authProvider: byPrivy.authProvider ?? byUser.authProvider,
    label: keepOtherLabel ? byUser.label : byPrivy.label,
    labelSource: keepOtherLabel ? "user" : byPrivy.labelSource,
    passkeys: mergePasskeys(byPrivy.passkeys, byUser.passkeys),
    createdAt: Math.min(byPrivy.createdAt, byUser.createdAt),
    lastUsedAt: Math.max(byPrivy.lastUsedAt, byUser.lastUsedAt),
    profileDeletedAt: byPrivy.profileDeletedAt ?? byUser.profileDeletedAt,
  };
  return {
    ...state,
    accounts: state.accounts.filter((account) => account.key !== byUser.key).map((account) => (account.key === merged.key ? merged : account)),
  };
};

/** A sign-in happened: create or refresh the entry for this account. */
export const recordSignIn = (input: RegistryState, snapshot: SignInSnapshot): RegistryState => {
  const state = mergeDuplicates(input, snapshot);
  const found = findAccount(state, snapshot);
  const base: LocalAccount =
    found ?? {
      key: snapshot.key,
      privyUserId: snapshot.privyUserId ?? null,
      userId: null,
      handle: null,
      smartAccountAddress: null,
      label: suggestAccountLabel({
        handle: snapshot.handle,
        taken: labelsInUse(state),
        bytes: snapshot.bytes,
      }),
      labelSource: "auto",
      authProvider: null,
      passkeys: [],
      createdAt: snapshot.now,
      lastUsedAt: snapshot.now,
      profileDeletedAt: null,
    };

  let passkeys = snapshot.passkeys ? syncPasskeys(base.passkeys, snapshot.passkeys, snapshot.now) : base.passkeys;
  if (snapshot.usedCredentialId) {
    const used = normalizeCredentialId(snapshot.usedCredentialId);
    passkeys = passkeys.some((p) => p.credentialId === used)
      ? passkeys.map((p) => (p.credentialId === used ? { ...p, verifiedAt: snapshot.now } : p))
      : [...passkeys, { credentialId: used, name: null, createdAt: snapshot.now, verifiedAt: snapshot.now, origin: "existing" as const }];
  }

  const handle = snapshot.handle ?? base.handle;
  const next: LocalAccount = {
    ...base,
    privyUserId: base.privyUserId ?? snapshot.privyUserId ?? null,
    userId: snapshot.userId ?? base.userId,
    handle,
    smartAccountAddress: snapshot.smartAccountAddress ?? base.smartAccountAddress,
    authProvider: snapshot.authProvider ?? base.authProvider,
    passkeys,
    lastUsedAt: snapshot.now,
    // A profile exists again: the one that was deleted is no longer the story.
    profileDeletedAt: snapshot.userId ? null : base.profileDeletedAt,
    label:
      base.labelSource === "auto" && handle
        ? suggestAccountLabel({ handle, taken: labelsInUse(state, base.key), bytes: snapshot.bytes })
        : base.label,
  };

  return found
    ? replaceAccount(state, next)
    : { ...state, accounts: [...state.accounts, next] };
};

export type RenameResult = LabelCheck | { ok: false; reason: "unknown-account"; label: string };

export const renameAccount = (
  state: RegistryState,
  key: string,
  input: string,
): { state: RegistryState; result: RenameResult } => {
  const account = state.accounts.find((candidate) => candidate.key === key);
  if (!account) return { state, result: { ok: false, reason: "unknown-account", label: "" } };
  const result = checkAccountLabel(input, labelsInUse(state, key));
  if (!result.ok) return { state, result };
  return { state: replaceAccount(state, { ...account, label: result.label, labelSource: "user" }), result };
};

export const removeAccount = (state: RegistryState, key: string): RegistryState => ({
  ...state,
  accounts: state.accounts.filter((account) => account.key !== key),
});

/**
 * The ATARA profile was deleted. It is gone from the server; the wallet and the
 * passkeys are not, and the address is kept so the person can find their funds.
 */
export const markProfileDeleted = (state: RegistryState, key: string, now: number): RegistryState => {
  const account = state.accounts.find((candidate) => candidate.key === key);
  if (!account) return state;
  return replaceAccount(state, {
    ...account,
    userId: null,
    handle: null,
    // A name that followed a handle now released must not follow anything.
    labelSource: "user",
    profileDeletedAt: now,
  });
};

export const markPasskeyVerified = (
  state: RegistryState,
  key: string,
  credentialId: string,
  now: number,
): RegistryState => {
  const account = state.accounts.find((candidate) => candidate.key === key);
  if (!account) return state;
  const id = normalizeCredentialId(credentialId);
  return replaceAccount(state, {
    ...account,
    passkeys: account.passkeys.map((p) => (p.credentialId === id ? { ...p, verifiedAt: now } : p)),
  });
};

/** A passkey this app just linked to the account. */
export const addPasskeyRecord = (
  state: RegistryState,
  key: string,
  input: { credentialId: string; name: string; now: number },
): RegistryState => {
  const account = state.accounts.find((candidate) => candidate.key === key);
  if (!account) return state;
  const id = normalizeCredentialId(input.credentialId);
  if (account.passkeys.some((p) => p.credentialId === id)) return state;
  return replaceAccount(state, {
    ...account,
    passkeys: [
      ...account.passkeys,
      { credentialId: id, name: input.name, createdAt: input.now, verifiedAt: input.now, origin: "atara" },
    ],
  });
};

export const removePasskeyRecord = (state: RegistryState, key: string, credentialId: string): RegistryState => {
  const account = state.accounts.find((candidate) => candidate.key === key);
  if (!account) return state;
  const id = normalizeCredentialId(credentialId);
  return replaceAccount(state, { ...account, passkeys: account.passkeys.filter((p) => p.credentialId !== id) });
};

/**
 * What to show for an account. Two accounts can end up with the same private
 * name (an older entry, a restored backup), so the name gets the @handle or the
 * short address when it is not unique. Identity never depends on this text.
 */
export const displayLabel = (account: LocalAccount, all: readonly LocalAccount[]): string => {
  const wanted = comparableLabel(account.label);
  const clash = all.some((other) => other.key !== account.key && comparableLabel(other.label) === wanted);
  if (!clash) return account.label;
  const detail = account.handle
    ? `@${account.handle}`
    : shortAddress(account.smartAccountAddress) || `#${account.key.slice(-4)}`;
  return `${account.label} · ${detail}`;
};

export type SwitchPlan =
  | { method: "passkey"; credentialId: string }
  | { method: "oauth"; provider: "google" | "apple" }
  | { method: "choose" };

/**
 * How to sign in to this account again. A passkey proven on this phone comes
 * first; then a Google or Apple account when that is how the account was made;
 * then any other known passkey. With none of these, the person picks on the
 * sign-in screen.
 */
export const planSwitch = (account: LocalAccount): SwitchPlan => {
  const proven = account.passkeys
    .filter((p) => p.verifiedAt !== null)
    .sort((a, b) => (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0))[0];
  if (proven) return { method: "passkey", credentialId: proven.credentialId };

  if (account.authProvider === "google" || account.authProvider === "apple") {
    return { method: "oauth", provider: account.authProvider };
  }

  const known = [...account.passkeys].sort((a, b) => b.createdAt - a.createdAt)[0];
  if (known) return { method: "passkey", credentialId: known.credentialId };
  return { method: "choose" };
};

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Whatever storage returns, only well-formed entries survive. */
export const sanitizeRegistry = (raw: unknown): RegistryState => {
  const list = (raw as { accounts?: unknown } | null)?.accounts;
  if (!Array.isArray(list)) return emptyRegistry();

  const seen = new Set<string>();
  const accounts: LocalAccount[] = [];
  for (const item of list as Record<string, unknown>[]) {
    if (!item || !isText(item.key) || !isText(item.label) || seen.has(item.key)) continue;
    seen.add(item.key);
    const passkeys = (Array.isArray(item.passkeys) ? (item.passkeys as Record<string, unknown>[]) : [])
      .filter((p) => p && isText(p.credentialId))
      .map<PasskeyRecord>((p) => ({
        credentialId: normalizeCredentialId(String(p.credentialId)),
        name: isText(p.name) ? p.name : null,
        createdAt: isTime(p.createdAt) ? p.createdAt : 0,
        verifiedAt: isTime(p.verifiedAt) ? p.verifiedAt : null,
        origin: p.origin === "atara" ? "atara" : "existing",
      }));
    accounts.push({
      key: item.key,
      privyUserId: isText(item.privyUserId) ? item.privyUserId : null,
      userId: isText(item.userId) ? item.userId : null,
      handle: isText(item.handle) ? item.handle : null,
      smartAccountAddress: isText(item.smartAccountAddress) ? item.smartAccountAddress : null,
      label: item.label,
      labelSource: item.labelSource === "user" ? "user" : "auto",
      authProvider: isText(item.authProvider) ? item.authProvider : null,
      passkeys,
      createdAt: isTime(item.createdAt) ? item.createdAt : 0,
      lastUsedAt: isTime(item.lastUsedAt) ? item.lastUsedAt : 0,
      profileDeletedAt: isTime(item.profileDeletedAt) ? item.profileDeletedAt : null,
    });
  }
  return { version: REGISTRY_VERSION, accounts };
};
