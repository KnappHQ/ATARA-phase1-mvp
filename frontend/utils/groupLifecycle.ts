/**
 * Archiving and deleting a group, in plain words.
 *
 * Archiving is personal and loses nothing. Deleting is the creator's, hides the group for
 * everybody, and is refused while anyone still owes money (the server checks it too; this is
 * only so the person is told before a confirmation dialog, not after).
 */

export const SETTLE_FIRST = "Settle balances first";

export const ARCHIVE_TITLE = "Archive this group?";
export const ARCHIVE_BODY =
  "It moves to Archived on your Groups tab. You keep all its history and can restore it any time. Nobody else sees a change.";

export const DELETE_TITLE = "Delete this group?";
export const DELETE_BODY =
  "This removes the group for everyone. Payments already made and everyone's Activity stay as they are. This can't be undone.";

export const SETTLE_FIRST_BODY =
  "Someone still owes money in this group. Settle every balance, then you can delete it.";

interface HasArchive {
  archivedAt?: string | null;
}

/** Groups to list, and the ones this person archived. */
export const splitGroups = <T extends HasArchive>(groups: T[]): { active: T[]; archived: T[] } => ({
  active: groups.filter((group) => !group.archivedAt),
  archived: groups.filter((group) => !!group.archivedAt),
});

export interface BalanceLike {
  owedByMe: number;
  owedToMe: number;
}

/** Cents so that 0.001 of noise does not read as money owed. */
const owes = (balance: BalanceLike) =>
  Math.round(balance.owedByMe * 100) > 0 || Math.round(balance.owedToMe * 100) > 0;

export interface DeleteGuard {
  /** Show the Delete action at all (the creator only). */
  visible: boolean;
  /** Can be deleted right now, as far as this phone knows. */
  allowed: boolean;
  reason: string | null;
}

export const deleteGuard = (input: {
  isCreator: boolean;
  memberBalances: BalanceLike[];
  /** Shares nobody has accepted or settled yet also count as owed. */
  hasOpenShares?: boolean;
}): DeleteGuard => {
  if (!input.isCreator) return { visible: false, allowed: false, reason: null };
  if (input.memberBalances.some(owes) || input.hasOpenShares)
    return { visible: true, allowed: false, reason: SETTLE_FIRST };
  return { visible: true, allowed: true, reason: null };
};
