/**
 * What the person typed on the identity step, kept on this phone so closing
 * the app does not lose it. Local only: it is never sent anywhere.
 *
 * Only the @handle and the public account name are kept. The terms box is
 * never stored, so it must be ticked again every time.
 */

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface OnboardingDraft {
  handle: string;
  accountName: string;
  savedAt: number;
}

/** Drafts by Privy user id. */
export type OnboardingDrafts = Record<string, OnboardingDraft>;

const isFresh = (draft: OnboardingDraft, now: number) =>
  now - draft.savedAt >= 0 && now - draft.savedAt < DRAFT_TTL_MS;

const asDraft = (value: unknown): OnboardingDraft | null => {
  if (!value || typeof value !== "object") return null;
  const { handle, accountName, savedAt } = value as Record<string, unknown>;
  if (typeof handle !== "string" || typeof accountName !== "string") return null;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  // Rebuilt field by field: nothing else stored under an entry is ever kept.
  return { handle, accountName, savedAt };
};

/** Keeps only well-formed drafts younger than 7 days. */
export const pruneDrafts = (drafts: unknown, now: number): OnboardingDrafts => {
  const result: OnboardingDrafts = {};
  if (!drafts || typeof drafts !== "object") return result;
  for (const [userId, value] of Object.entries(drafts as Record<string, unknown>)) {
    const draft = asDraft(value);
    if (draft && isFresh(draft, now)) result[userId] = draft;
  }
  return result;
};

/** Saves one person's draft. An empty draft removes the entry instead. */
export const saveDraft = (
  drafts: OnboardingDrafts,
  userId: string,
  values: { handle: string; accountName: string },
  now: number,
): OnboardingDrafts => {
  if (!userId) return drafts;
  if (!values.handle && !values.accountName.trim()) return clearDraft(drafts, userId);
  return {
    ...drafts,
    [userId]: { handle: values.handle, accountName: values.accountName, savedAt: now },
  };
};

/** The saved draft, unless it is older than 7 days. */
export const readDraft = (
  drafts: OnboardingDrafts,
  userId: string | null | undefined,
  now: number,
): OnboardingDraft | null => {
  if (!userId) return null;
  const draft = asDraft(drafts[userId]);
  return draft && isFresh(draft, now) ? draft : null;
};

export const clearDraft = (drafts: OnboardingDrafts, userId: string): OnboardingDrafts => {
  if (!(userId in drafts)) return drafts;
  const { [userId]: _removed, ...rest } = drafts;
  return rest;
};
