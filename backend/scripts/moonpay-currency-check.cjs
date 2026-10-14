#!/usr/bin/env node
/**
 * Asks MoonPay what MOONPAY_CURRENCY_CODE really is, so nobody has to guess
 * whether "usdc_base" delivers on Base Sepolia in sandbox (and not on Ethereum
 * Sepolia, or on Base mainnet).
 *
 *   On Render (Shell tab):  node scripts/moonpay-currency-check.cjs
 *   Locally:                node scripts/moonpay-currency-check.cjs
 *
 * Uses only the PUBLISHABLE key (MOONPAY_API_KEY), never the secret key, and
 * prints no key. Nothing is bought and nothing is signed.
 */
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const BASE_SEPOLIA = { chainId: "84532", usdc: "0x036cbd53842c5426634e7929541ec2318f3dcf7e" };
const BASE_MAINNET = { chainId: "8453", usdc: "0x833589fcd6edb5e75bc6deeef7a1a0c27db4e7ce" };

const main = async () => {
  const apiKey = (process.env.MOONPAY_API_KEY || "").trim();
  const code = (process.env.MOONPAY_CURRENCY_CODE || "usdc_base").trim().toLowerCase();
  if (!apiKey) {
    console.log("MOONPAY_API_KEY is not set: nothing to check.");
    process.exit(1);
  }
  const kind = apiKey.startsWith("pk_test_") ? "sandbox (pk_test)" : apiKey.startsWith("pk_live_") ? "live (pk_live)" : "unknown";
  console.log(`Publishable key kind: ${kind}`);
  console.log(`Currency code checked: ${code}`);

  const response = await fetch(`https://api.moonpay.com/v3/currencies?apiKey=${encodeURIComponent(apiKey)}`);
  if (!response.ok) {
    console.log(`MoonPay answered HTTP ${response.status}. Check the key, then try again.`);
    process.exit(1);
  }
  const list = await response.json();
  const currency = Array.isArray(list) ? list.find((item) => String(item.code).toLowerCase() === code) : null;
  if (!currency) {
    console.log(`MoonPay does not list "${code}" for this key. Pick a code from the MoonPay dashboard.`);
    process.exit(1);
  }
  const meta = currency.metadata || {};
  const chainId = meta.chainId === undefined || meta.chainId === null ? "(not given)" : String(meta.chainId);
  const contract = String(meta.contractAddress || "(not given)").toLowerCase();
  console.log(`  name            ${currency.name}`);
  console.log(`  networkCode     ${meta.networkCode ?? "(not given)"}`);
  console.log(`  chainId         ${chainId}`);
  console.log(`  contractAddress ${contract}`);
  console.log(`  supportsTestMode ${String(currency.supportsTestMode)}`);
  console.log(`  isSuspended     ${String(currency.isSuspended)}`);
  console.log("");
  if (chainId === BASE_SEPOLIA.chainId || contract === BASE_SEPOLIA.usdc) {
    console.log("Base Sepolia: matches the network ATARA's beta uses.");
  } else if (chainId === BASE_MAINNET.chainId || contract === BASE_MAINNET.usdc) {
    console.log("This metadata describes Base MAINNET. In sandbox MoonPay may still deliver test funds on a testnet:");
    console.log("ask MoonPay which testnet a sandbox purchase of this code delivers to, before relying on it.");
  } else {
    console.log("Not Base. Do not use this code for ATARA (wrong network for the receiving address).");
  }
};

main().catch((error) => {
  console.log(`Could not reach MoonPay: ${error && error.message ? error.message : "unknown error"}`);
  process.exit(1);
});
