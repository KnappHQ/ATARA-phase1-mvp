export const PRIVACY_POLICY_LAST_UPDATED = "09/09/2026";

export const PRIVACY_POLICY_FOOTER_TEXT = "ATARA LTD — privacy@atara.finance";

export interface PrivacyPolicySection {
  title: string;
  body: string[];
  bullets?: string[];
}

export const PRIVACY_POLICY_INTRO =
  'This Privacy Policy explains how ATARA LTD ("ATARA", "we", "us") collects, uses, and protects your personal data when you use the ATARA app and website (the "Service"). ATARA LTD is a company registered in England and Wales (company number 17054670), registered office: 71-75 Shelton Street, Covent Garden, London, United Kingdom, WC2H 9JQ. We act as the data controller for the personal data described below. This policy is intended to comply with the UK GDPR and, where applicable, the EU GDPR.';

export const PRIVACY_POLICY_SECTIONS: PrivacyPolicySection[] = [
  {
    title: "1. Who this applies to",
    body: [
      "This policy applies to everyone who uses ATARA. ATARA is intended for adults only and is not directed at anyone under 18.",
    ],
  },
  {
    title: "2. What ATARA is — and what we do not hold",
    body: [
      "ATARA is a self-custodial crypto wallet built on Base. You control your funds. ATARA does not take custody of your crypto assets and does not hold a conventional custodial balance on your behalf. Wallet authentication and key-management infrastructure are provided by specialist third-party providers. ATARA does not ask you to disclose a seed phrase to us.",
    ],
  },
  {
    title: "3. Information we collect",
    body: [
      "We collect information needed to provide, secure, and improve the Service.",
    ],
    bullets: [
      "Account information: the username and display name you choose; email address and name only where you choose Google, Apple, email, or another recovery provider. Wallet-only sign-in does not require ATARA to receive an email address.",
      "Wallet and transaction information: public wallet addresses and blockchain transaction information. Public blockchain records are generally permanent and outside ATARA's control.",
      "Technical information: device type, operating system, app version, IP address received by our servers, and security or diagnostic information needed to operate the Service.",
      "Usage information: limited product events may be processed if analytics is enabled. Passive product analytics is disabled for the current beta unless separately disclosed and enabled.",
      "Communications: information you provide when you contact support or send feedback.",
      "We do not ask you to provide a seed phrase or private key to ATARA support.",
    ],
  },
  {
    title: "4. How we use your information",
    body: [
      "We use personal data to provide and operate the Service; authenticate users; maintain security; prevent fraud and abuse; provide support; comply with applicable legal obligations; and improve ATARA.",
      "Depending on the processing activity, our legal basis may include performance of a contract, compliance with a legal obligation, legitimate interests such as security and fraud prevention, or consent where required.",
    ],
  },
  {
    title: "5. Who we share your information with",
    body: [
      "ATARA uses third-party providers for authentication and embedded-wallet infrastructure (Privy), external-wallet discovery (Reown when enabled), smart-account and blockchain connectivity (Alchemy), hosting/database services, error monitoring, and other technical functions. Providers process information only as needed to deliver those services and subject to their contractual and legal obligations. We may also disclose information where required by law. We do not sell personal data.",
    ],
  },
  {
    title: "6. International transfers",
    body: [
      "Some providers may process data outside the UK or EEA. Where required, we use appropriate safeguards for international transfers, such as adequacy decisions or approved contractual safeguards.",
    ],
  },
  {
    title: "7. Blockchain data",
    body: [
      "Transactions made on public blockchains such as Base can be public, permanent, and technically impossible for ATARA to delete or alter. Closing an ATARA account does not erase public blockchain records.",
    ],
  },
  {
    title: "8. Data retention",
    body: [
      "We retain off-chain personal data only for as long as reasonably necessary for the purposes described in this policy, including security, legal, dispute-resolution, and fraud-prevention requirements. Some minimal anti-replay payment records may be retained where necessary to prevent a blockchain receipt from being reused fraudulently.",
    ],
  },
  {
    title: "9. Your rights",
    body: [
      "Depending on where you live, you may have rights to access, correct, erase, restrict, object to processing, or obtain a portable copy of certain personal data, and to withdraw consent where processing relies on consent. Contact privacy@atara.finance to exercise applicable rights. You may also complain to the relevant supervisory authority, including the UK ICO or, where applicable, an EU data protection authority such as the CNIL in France.",
    ],
  },
  {
    title: "10. Security",
    body: [
      "We use technical and organisational measures designed to protect personal data, including encrypted transport and access controls. No online service can guarantee absolute security. Keep your device, authentication methods, and recovery methods secure.",
    ],
  },
  {
    title: "11. Children",
    body: [
      "ATARA is not intended for anyone under 18 and we do not knowingly offer the Service to children.",
    ],
  },
  {
    title: "12. Account deletion",
    body: [
      "You can request deletion from the Profile section of the ATARA app. Account deletion removes or disconnects eligible off-chain account information in accordance with our retention obligations. Shared expenses, debts and payment receipts remain under a deleted-account label to preserve other members’ records and prevent receipt reuse. Public blockchain records cannot be deleted.",
    ],
  },
  {
    title: "13. Changes to this policy",
    body: [
      'We may update this policy from time to time. We will make the updated version available through the Service and change the "Last updated" date.',
    ],
  },
  {
    title: "14. Contact",
    body: [
      "ATARA LTD, 71-75 Shelton Street, Covent Garden, London, United Kingdom, WC2H 9JQ — privacy@atara.finance",
    ],
  },
];
