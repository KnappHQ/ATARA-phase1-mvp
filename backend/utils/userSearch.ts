import { Prisma } from "@prisma/client";

/**
 * How `GET /user/search` decides what to match, and what it gives back.
 *
 * The previous behaviour made the endpoint a directory rather than a lookup:
 * a substring of any length matched `handle`, `displayName` *and*
 * `smartAccountAddress`, and every hit returned both `publicAddress` and
 * `smartAccountAddress`. One authenticated account could therefore sweep the
 * alphabet and map every handle to its on-chain address.
 *
 * Kept pure and separate from the service so it can be tested without Prisma.
 */

/**
 * Matches the minimum handle length enforced by `normalizeHandle`
 * (utils/profileValidation.ts), so the two rules cannot drift apart.
 */
export const SEARCH_MIN_LENGTH = 3;

/** Long enough to be a deliberate address lookup rather than an accident. */
const ADDRESS_PREFIX = /^0x[0-9a-f]{4,}$/;

/** `publicAddress` is deliberately absent: nothing in the app reads it. */
export const USER_SEARCH_SELECT = {
  id: true,
  handle: true,
  displayName: true,
  profilePicUrl: true,
  smartAccountAddress: true,
} as const;

export const normalizeSearchQuery = (query: string): string =>
  query.replace("@", "").trim().toLowerCase();

/**
 * Returns the `where` clause for a search, or `null` when the query is too
 * short to run one at all.
 */
export const buildSearchFilter = (
  query: string,
): Prisma.UserWhereInput | null => {
  const cleanQuery = normalizeSearchQuery(query);

  if (cleanQuery.length < SEARCH_MIN_LENGTH) {
    return null;
  }

  const conditions: Prisma.UserWhereInput[] = [
    { handle: { contains: cleanQuery, mode: "insensitive" } },
    { displayName: { contains: cleanQuery, mode: "insensitive" } },
  ];

  // Only when the caller clearly typed an address. Matching every query
  // against the address column is what let a plain word reveal a wallet.
  if (ADDRESS_PREFIX.test(cleanQuery)) {
    conditions.push({
      smartAccountAddress: { contains: cleanQuery, mode: "insensitive" },
    });
  }

  return { OR: conditions };
};
