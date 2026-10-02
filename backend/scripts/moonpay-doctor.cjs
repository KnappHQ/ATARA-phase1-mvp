#!/usr/bin/env node
/**
 * Checks the MoonPay configuration of THIS environment and says exactly what is
 * wrong, without printing a single secret: only whether each variable is present,
 * its length, which kind of key it looks like, and fixed problem codes.
 *
 *   On Render (Shell tab of the service):   node scripts/moonpay-doctor.cjs
 *   Locally, after `npm run build`:         node scripts/moonpay-doctor.cjs
 *
 * Exit code 1 when something blocks MoonPay, 0 otherwise.
 */
const path = require("node:path");

const load = (name) => {
  try {
    return require(path.join(__dirname, "..", "dist", name));
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    require("ts-node/register");
    return require(path.join(__dirname, "..", name.replace(/\.js$/, ".ts")));
  }
};

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
const { inspectMoonPayConfig, readMoonPayEnv, problemCode, PROBLEM_FIXES, WARNING_FIXES } = load("utils/moonpayConfig.js");

const report = inspectMoonPayConfig(readMoonPayEnv());
const yes = (value) => (value ? "yes" : "NO");
const line = (text = "") => process.stdout.write(`${text}\n`);

line(`MoonPay configuration check (environment: ${report.mode}; selected by ALCHEMY_NETWORK)`);
line(`  MOONPAY_API_KEY      present=${yes(report.apiKey.present)} length=${report.apiKey.length} kind=${report.apiKey.kind}`);
line(`  MOONPAY_SECRET_KEY   present=${yes(report.secretKey.present)} length=${report.secretKey.length} kind=${report.secretKey.kind}`);
line(`  widget host          ${report.widgetHost ?? "(default)"}`);
line(`  redirect configured  ${yes(report.redirectConfigured)}`);
line();

if (report.warnings.length) {
  line("Warnings (handled by the server, worth cleaning up):");
  for (const warning of report.warnings) line(`  - ${warning}: ${WARNING_FIXES[warning]}`);
  line();
}

if (report.problems.length) {
  line("PROBLEMS (each of these stops MoonPay):");
  for (const problem of report.problems) line(`  - ${problemCode(problem)}: ${PROBLEM_FIXES[problem]}`);
  line();
  process.exitCode = 1;
} else {
  line("Problems: none found in the variables.");
  line();
  // The server builds a real URL with the real configuration and checks that the
  // signature in it verifies, over the exact string it is about to hand out.
  try {
    const service = load("services/onramp.service.js");
    const { MOONPAY_SECRET_KEY } = load("utils/constants.js");
    const url = service.buildMoonPayWidgetUrl({ walletAddress: "0x000000000000000000000000000000000000dEaD", baseCurrencyAmount: "50.00" });
    const verified = service.verifyMoonPayUrl(url, MOONPAY_SECRET_KEY);
    line(`Signing self-test: ${verified ? "PASS" : "FAIL"} (the URL this server produces ${verified ? "verifies" : "does NOT verify"} against its own secret)`);
    if (!verified) process.exitCode = 1;
  } catch (error) {
    line(`Signing self-test: FAIL (${error && error.code ? error.code : "could not build a URL"})`);
    process.exitCode = 1;
  }
  line();
  line("Cannot be checked from here: that the secret key and the publishable key come from the SAME MoonPay");
  line("app and environment. If every line above is fine and MoonPay still says \"signature check failed\",");
  line("that pairing is the remaining cause: in the MoonPay dashboard (Developers > API keys) copy the");
  line("publishable AND the secret key of the same environment again, and replace both variables.");
}
