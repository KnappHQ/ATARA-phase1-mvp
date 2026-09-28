/**
 * An address split into groups of four, so it can be compared character by
 * character with the one the recipient shows. The whole address is always
 * shown: a truncated one hides exactly the characters an address-poisoning
 * attack changes.
 */
export const groupAddress = (address: string): string => {
  const hasPrefix = address.startsWith("0x");
  const body = hasPrefix ? address.slice(2) : address;
  const groups = body.match(/.{1,4}/g) ?? [];
  return `${hasPrefix ? "0x " : ""}${groups.join(" ")}`;
};
