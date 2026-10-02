import type { ProviderStatusSource } from "./paymentOperations";

/**
 * A read-only status source for the wallet service: "what happened to this call
 * id". It takes no signer and no account, so it works whether or not the wallet
 * has finished starting, and for a payment made from an account that is not the
 * one signed in. The libraries are passed in so the same code runs against a
 * scripted transport in tests.
 */
export const createProviderStatusSource = (deps: {
  chain: unknown;
  transport: unknown;
  createClient: (config: any) => any;
  getCallsStatus: (client: any, input: any) => Promise<unknown>;
}): ProviderStatusSource => {
  const client = deps.createClient({ chain: deps.chain, transport: deps.transport });
  return { getCallsStatus: (input) => deps.getCallsStatus(client, { id: input.id }) };
};
