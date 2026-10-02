/**
 * Tells a refusal by the fee sponsor apart from a payment that failed for
 * another reason.
 *
 * Only the first kind may be shown as "gas sponsorship is unavailable". The
 * network's own refusals (a simulation that reverts, an account validation
 * that fails with AA23) say nothing about sponsorship: showing the sponsorship
 * message for them hides the real cause from the person and from us.
 */
const SPONSOR_REFUSAL_PATTERNS = [
  /paymaster/i,
  /gas sponsor/i,
  /sponsorship/i,
  /gas manager/i,
  /policy/i,
  /limit reached/i,
  /spend limit/i,
  /quota/i,
  // No sponsor and no native balance: the fee was left to the account.
  /insufficient funds for gas/i,
];

export const isSponsorRefusal = (message: string): boolean =>
  SPONSOR_REFUSAL_PATTERNS.some((pattern) => pattern.test(message));
