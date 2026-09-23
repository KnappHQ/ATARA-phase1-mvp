const assert = require("node:assert/strict");
const test = require("node:test");
require("ts-node/register");

const { canUseAgentCapability } = require("../utils/agentAccessPolicy.ts");

test("agent capabilities are denied without explicit read scopes", () => {
  assert.equal(canUseAgentCapability("get_balances", []), false);
  assert.equal(canUseAgentCapability("get_contacts", ["balances:read"]), false);
  assert.equal(canUseAgentCapability("get_contacts", ["contacts:read"]), true);
});

test("unknown or state-changing agent capabilities are never allowed", () => {
  const allReadScopes = ["balances:read", "contacts:read", "debts:read", "vaults:read"];
  for (const capability of ["transfer", "sign_message", "create_payment", "send_usdc", "__proto__"])
    assert.equal(canUseAgentCapability(capability, allReadScopes), false);
});
