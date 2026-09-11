import { Router } from "express";

const router = Router();

const COMPANY = {
  name: "ATARA LTD",
  number: "17054670",
  address:
    "71-75 Shelton Street, Covent Garden, London, United Kingdom, WC2H 9JQ",
};

const page = (title: string, body: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="index,follow" />
  <title>${title} — ATARA</title>
  <style>
    body{margin:0;background:#080808;color:#f6f3eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
    main{max-width:760px;margin:0 auto;padding:48px 22px 80px}
    h1,h2{line-height:1.2} h1{font-size:38px;margin-bottom:8px} h2{margin-top:32px}
    p,li{color:#d8d3c8} a{color:#fff} .muted{color:#999287} .card{border:1px solid #2b2925;padding:18px;margin:20px 0;background:#11100f}
  </style>
</head>
<body><main>${body}</main></body>
</html>`;

router.get("/privacy", (_req, res) => {
  res.type("html").send(
    page(
      "Privacy Policy",
      `<h1>Privacy Policy</h1>
      <p class="muted">Last updated: 9 September 2026</p>
      <p>${COMPANY.name} (company number ${COMPANY.number}), registered office ${COMPANY.address}, is the controller for personal data described here.</p>
      <h2>What ATARA is</h2><p>ATARA is software for self-custodial crypto payments and related group and Vault features. ATARA does not hold a conventional custodial crypto balance for users.</p>
      <h2>Data we process</h2><p>We may process usernames, public wallet addresses, blockchain transaction information, technical/server security information, support messages and feedback. Email address and name are processed only where a user chooses a social or recovery provider. Wallet-only sign-in does not require ATARA to receive an email address. Passive product analytics is disabled for the current beta unless separately disclosed and enabled.</p>
      <h2>Why we process it</h2><p>We process data to operate and secure the Service, authenticate users, prevent fraud and abuse, provide support, comply with law and improve ATARA.</p>
      <h2>Providers and transfers</h2><p>ATARA currently uses Privy for embedded authentication/wallet infrastructure, Reown for external-wallet discovery when enabled, Alchemy for smart-account and blockchain connectivity, plus hosting/database and error-monitoring providers. Some providers may process data outside the UK or EEA under applicable transfer safeguards.</p>
      <h2>Blockchain data</h2><p>Public blockchain records can be permanent and cannot generally be deleted or changed by ATARA.</p>
      <h2>Retention and deletion</h2><p>Eligible off-chain account data is removed or disconnected when an account is deleted, subject to legal, security and fraud-prevention retention requirements. Shared expenses, debts and payment receipts remain associated with a deleted-account label to preserve other members’ records. Minimal anti-replay payment records are retained to prevent reuse of blockchain receipts.</p>
      <h2>Your rights</h2><p>Depending on applicable law, you may request access, correction, erasure, restriction, objection or portability. Contact <a href="mailto:privacy@atara.finance">privacy@atara.finance</a>.</p>
      <h2>Contact</h2><p>${COMPANY.name}, ${COMPANY.address}<br/><a href="mailto:privacy@atara.finance">privacy@atara.finance</a></p>`,
    ),
  );
});

router.get("/terms", (_req, res) => {
  res.type("html").send(
    page(
      "Terms of Service",
      `<h1>Terms of Service</h1>
      <p class="muted">Last updated: 9 September 2026</p>
      <p>These terms govern use of ATARA, provided by ${COMPANY.name}, company number ${COMPANY.number}, ${COMPANY.address}.</p>
      <h2>Eligibility</h2><p>You must be at least 18 and may not use ATARA where prohibited by applicable law or sanctions restrictions.</p>
      <h2>Beta service</h2><p>The beta may use test networks such as Base Sepolia and test tokens with no monetary value. Features may change, be suspended or removed during testing.</p>
      <h2>Self-custody</h2><p>You are responsible for authentication methods, recipients, amounts and transaction decisions. Blockchain transactions can be irreversible.</p>
      <h2>Risks</h2><p>Crypto and blockchain technology involves technical, market, network, smart-contract, authentication and regulatory risks. ATARA does not provide investment, financial, legal or tax advice.</p>
      <h2>Third-party services</h2><p>ATARA depends on third-party infrastructure that may have separate terms, geographic restrictions, outages or fees.</p>
      <h2>Law</h2><p>These terms are governed by the laws of England and Wales, without limiting mandatory consumer rights that apply where you live.</p>
      <h2>Contact</h2><p><a href="mailto:support@atara.finance">support@atara.finance</a></p>`,
    ),
  );
});

router.get("/account-deletion", (_req, res) => {
  res.type("html").send(
    page(
      "Delete your ATARA account",
      `<h1>Delete your ATARA account</h1>
      <p>You can request deletion directly inside the ATARA app:</p>
      <div class="card"><strong>Profile → Delete account → confirm deletion</strong></div>
      <p>Deleting your account removes or disconnects eligible off-chain ATARA account information, subject to lawful security, fraud-prevention and record-retention requirements.</p>
      <p>Public blockchain transactions and wallet addresses recorded on-chain cannot be erased by ATARA.</p>
      <p>If you cannot access the app, contact <a href="mailto:privacy@atara.finance">privacy@atara.finance</a> from the email associated with your account and request account deletion.</p>
      <h2>Company</h2><p>${COMPANY.name}, company number ${COMPANY.number}<br/>${COMPANY.address}</p>`,
    ),
  );
});

export default router;
