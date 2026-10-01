/**
 * The three identifiers behind one payment. They are different things and no
 * screen, log or query may use one for another.
 *
 * ATARA sends a payment as an ERC-4337 user operation through Alchemy's Wallet
 * API. Sending it produces, over time:
 *
 *  - the call id ("bundle id"): what `sendCalls` returns and what
 *    `getCallsStatus` takes. It is Alchemy's own identifier and exists nowhere
 *    on the chain. For a user operation it is two 32-byte words: the chain id,
 *    then the user operation hash. That is what the SDK's own documented
 *    examples show (@alchemy/wallet-api-types, src/rpc/examples.ts).
 *  - the user operation hash: the ERC-4337 hash of the operation. It is the
 *    indexed field of the EntryPoint contract's `UserOperationEvent`, so the
 *    chain itself can say whether the operation ran, whatever the provider
 *    still remembers.
 *  - the transaction hash: the hash of the transaction that carried the
 *    operation. It exists only once the operation is included, and it is the one
 *    ATARA's service needs in order to record the payment.
 *
 * The call id is treated as opaque wherever it comes from the provider. It is
 * only taken apart when it has exactly the documented shape, and what comes out
 * is used to ask the chain, never to decide that a payment succeeded.
 */

export type Hex32 = `0x${string}`;

const HASH_32 = /^0x[0-9a-fA-F]{64}$/;
const CALL_ID = /^0x[0-9a-fA-F]{128}$/;

export const isHash32 = (value: unknown): value is Hex32 =>
  typeof value === "string" && HASH_32.test(value);

export interface ParsedCallId {
  chainId: number;
  userOpHash: Hex32;
}

/** The chain id and the user operation hash inside a call id, or null. */
export const parseCallId = (id: unknown): ParsedCallId | null => {
  if (typeof id !== "string" || !CALL_ID.test(id)) return null;
  const chain = BigInt(`0x${id.slice(2, 66)}`);
  if (chain <= 0n || chain > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return {
    chainId: Number(chain),
    userOpHash: `0x${id.slice(66).toLowerCase()}` as Hex32,
  };
};

/** The call id Alchemy gives a user operation, for tests and for comparisons. */
export const buildCallId = (chainId: number, userOpHash: string): string =>
  `0x${chainId.toString(16).padStart(64, "0")}${userOpHash.replace(/^0x/, "").toLowerCase()}`;

/** "0xc69e…d392", for a screen; the whole value is always kept and copyable. */
export const shortHash = (value: string | undefined | null): string =>
  value && value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : (value ?? "");
