/**
 * Default-deny capability policy for a future delegated AI gateway.
 * This module grants no credential, starts no server and cannot sign transactions.
 * Every exposed agent request will also require its own revocable, scoped token,
 * explicit user consent, expiry and per-agent rate limits before launch.
 */
export const AGENT_READ_SCOPES = [
  "balances:read",
  "contacts:read",
  "debts:read",
  "vaults:read",
] as const;

export type AgentReadScope = (typeof AGENT_READ_SCOPES)[number];

const CAPABILITIES: Readonly<Record<string, AgentReadScope>> = Object.freeze({
  get_balances: "balances:read",
  get_contacts: "contacts:read",
  get_debts: "debts:read",
  get_vaults: "vaults:read",
});

export function canUseAgentCapability(
  capability: string,
  grantedScopes: readonly string[],
): boolean {
  const requiredScope = Object.prototype.hasOwnProperty.call(CAPABILITIES, capability)
    ? CAPABILITIES[capability]
    : undefined;
  return !!requiredScope && grantedScopes.includes(requiredScope);
}
