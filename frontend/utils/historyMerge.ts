/**
 * Where a payment can be listed twice, and the only two ways one is allowed to
 * count as the same as another.
 *
 * A payment can be known to this phone from up to three places: ATARA's history
 * (the service), the phone's own queue of confirmed payments not yet recorded,
 * and the chain. Two entries are the same payment when they carry the same
 * transaction hash, or the same record id from the service. Never because they
 * have the same amount and the same recipient: paying the same person the same
 * amount twice in a row is ordinary, and merging those two would hide a real
 * payment.
 */

const norm = (hash: string | null | undefined) => (hash ? hash.toLowerCase() : "");

/** A payment waiting to be recorded is hidden once the service already lists it. */
export const hideRecorded = <T extends { transactionHash: string }>(
  queued: readonly T[],
  history: readonly { txHash: string }[],
): T[] => {
  const listed = new Set(history.map((row) => norm(row.txHash)).filter(Boolean));
  return queued.filter((entry) => !listed.has(norm(entry.transactionHash)));
};

/** The same service record listed twice (two overlapping fetches) is listed once. Order is kept. */
export const dedupeHistory = <T extends { id: string }>(rows: readonly T[]): T[] => {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    kept.push(row);
  }
  return kept;
};
