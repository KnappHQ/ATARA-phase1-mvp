export const PRIVACY_POLICY_LAST_UPDATED = "08/05/2026";

export const PRIVACY_POLICY_FOOTER_TEXT =
  "ATARA UK Ltd — privacy@atara.finance";

export interface PrivacyPolicySection {
  title: string;
  body: string[];
  bullets?: string[];
}

export const PRIVACY_POLICY_INTRO =
  'This Privacy Policy explains how ATARA UK Ltd ("ATARA", "we", "us") collects, uses, and protects your personal data when you use the ATARA app and website (the "Service"). ATARA UK Ltd is a company registered in England and Wales (company number 17054670), registered office: [adresse enregistrée]. We act as the data controller for the personal data described below. This policy complies with the UK GDPR and the EU GDPR.';

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
      "ATARA is a self-custodial crypto wallet built on Base. You control your funds. We do not take custody of your assets, and we do not have access to, store, or control your private keys or wallet recovery in a way that would let us move your funds on your behalf. Key management is handled through secure multi-party computation (MPC) technology provided by our infrastructure partner.",
    ],
  },
  {
    title: "3. Information we collect",
    body: [
      "We collect information needed to provide, secure, and improve the Service.",
    ],
    bullets: [
      "Account information: email address and name, provided through Google or Apple sign-in; the username you choose for sending and receiving payments.",
      "Wallet and transaction information: your public wallet address and on-chain transaction history, which is recorded on a public blockchain and is by nature public, permanent, and outside our control.",
      "Technical and device information: IP address, device type, operating system, app version, and device identifiers.",
      "Usage information: how you interact with the app, collected through analytics tools to help us improve the Service.",
      "Communications: any information you share when you contact our support team.",
      "We do not collect your private keys, seed phrase, or recovery information.",
    ],
  },
  {
    title: "4. How we use your information",
    body: [
      "To provide and operate the Service; to maintain security, prevent fraud, and protect users; to comply with legal and regulatory obligations including applicable anti-money laundering requirements; to improve and develop the Service; and to communicate with you.",
      "Legal bases (GDPR Article 6): performance of a contract, compliance with a legal obligation, our legitimate interests (security, fraud prevention, product improvement), and your consent where required.",
    ],
  },
  {
    title: "5. Who we share your information with",
    body: [
      "We use trusted third-party processors to operate ATARA, including providers for wallet infrastructure and authentication, blockchain network access, database and hosting, and product analytics. These providers only process your data on our instructions and under contract. We may also disclose data where required by law or valid legal request. We do not sell your personal data.",
    ],
  },
  {
    title: "6. International transfers",
    body: [
      "Some service providers are located outside the UK/EU (for example, in the United States). Where personal data is transferred outside the UK/EEA, we rely on appropriate safeguards such as Standard Contractual Clauses.",
    ],
  },
  {
    title: "7. Blockchain data",
    body: [
      "Transactions you make are recorded on a public blockchain (Base). Blockchain data is public, permanent, and cannot be changed or deleted by us or anyone else. This is a fundamental property of the technology.",
    ],
  },
  {
    title: "8. Data retention",
    body: [
      "We keep your personal data only as long as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements. On-chain data cannot be deleted (see section 7).",
    ],
  },
  {
    title: "9. Your rights",
    body: [
      "Under the UK GDPR and GDPR you have the right to access your data, correct it, request erasure, object to or restrict processing, request portability, and withdraw consent. To exercise these rights, contact privacy@atara.finance. You also have the right to lodge a complaint with a supervisory authority — in the UK, the ICO; in France, the CNIL.",
    ],
  },
  {
    title: "10. Security",
    body: [
      "We use technical and organisational measures to protect your personal data, including encryption in transit. No system is perfectly secure, and you are responsible for keeping your device and login credentials safe.",
    ],
  },
  {
    title: "11. Children",
    body: [
      "ATARA is not intended for, and we do not knowingly collect data from, anyone under 18.",
    ],
  },
  {
    title: "12. Changes to this policy",
    body: [
      'We may update this policy from time to time. We will post the updated version here and change the "Last updated" date.',
    ],
  },
  {
    title: "13. Contact",
    body: ["ATARA UK Ltd — privacy@atara.finance"],
  },
];
