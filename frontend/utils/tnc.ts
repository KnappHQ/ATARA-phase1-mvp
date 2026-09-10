export const TNC_LAST_UPDATED = "09/09/2026";

export const TNC_FOOTER_TEXT =
  "ATARA LTD — support@atara.finance";

export interface TncSection {
  title: string;
  body: string;
  highlight?: string;
  bullets?: string[];
  link?: {
    label: string;
    url: string;
  };
}

export const TNC_SECTIONS: TncSection[] = [
  {
    title: "Introduction",
    body: 'These Terms of Service ("Terms") govern your use of the ATARA app and related services (the "Service"), provided by ATARA LTD, a company registered in England and Wales (company number 17054670), registered office at 71-75 Shelton Street, Covent Garden, London, United Kingdom, WC2H 9JQ. By using ATARA, you agree to these Terms. If you do not agree, do not use the Service.',
  },
  {
    title: "1. Eligibility",
    body: "You must be at least 18 years old and legally able to enter into these Terms. You may not use ATARA where use of the Service is prohibited by applicable law or sanctions restrictions.",
  },
  {
    title: "2. The Service",
    body: "ATARA is software for self-custodial crypto payments and related group and Vault features on supported blockchain networks. The beta may use test networks, limited assets, and experimental functionality. Features may change, be suspended, or be removed during the beta.",
  },
  {
    title: "3. Self-custody and your responsibilities",
    body: "ATARA does not hold a conventional custodial crypto balance for you. You are responsible for your account, authentication methods, recipients, amounts, and transaction decisions. Blockchain transactions can be irreversible. ATARA may be unable to reverse or recover a transaction or restore access if your authentication and recovery methods are lost.",
  },
  {
    title: "4. Beta and test networks",
    body: "During the beta, some features may operate on test networks such as Base Sepolia and may use test tokens with no monetary value. Do not treat test balances, simulated assets, or preview data as real funds. ATARA will clearly separate test or simulated functionality from supported real-asset functionality.",
  },
  {
    title: "5. No financial advice",
    body: "ATARA does not provide investment, financial, legal, or tax advice. Crypto assets can be volatile and involve significant risks. You are responsible for your own decisions.",
  },
  {
    title: "6. Acceptable use",
    body: "You must not use ATARA for unlawful activity, fraud, sanctions evasion, money laundering, terrorist financing, exploitation, or any activity prohibited by applicable law. We may restrict access to ATARA services where reasonably necessary for security, legal compliance, abuse prevention, or protection of users.",
  },
  {
    title: "7. Fees",
    body: "Blockchain network fees, third-party provider fees, or ATARA service fees may apply to supported functionality. Where ATARA controls a fee, it will be disclosed before the relevant action where reasonably practicable. Network fees are determined by the applicable blockchain or infrastructure and may change.",
  },
  {
    title: "8. Third-party services",
    body: "ATARA relies on third-party providers for authentication, wallet infrastructure, blockchain connectivity, hosting and other technical services. Third-party services may have their own terms, availability, geographic limits, compliance requirements, or fees.",
  },
  {
    title: "9. Risks",
    body: "Crypto and blockchain technology involves risks including irreversible transactions, smart-contract defects, network congestion, software bugs, authentication loss, third-party outages, and changes in law or regulation. Only use supported features when you understand the relevant risks.",
    link: {
      label: "Risk Disclaimer",
      url: "https://atara.finance/risk-disclaimer",
    },
  },
  {
    title: "10. Intellectual property",
    body: "The ATARA name and branding are owned by or licensed to ATARA LTD. Open-source components remain governed by their applicable licences. If ATARA publishes its own source code under an open-source licence, that licence will define the rights granted for that code; source availability alone does not grant permission to reuse it.",
  },
  {
    title: "11. Disclaimers",
    body: 'To the extent permitted by law, the Service is provided "as is" and "as available". The beta may contain defects or interruptions. Nothing in these Terms limits rights or warranties that cannot lawfully be excluded.',
  },
  {
    title: "12. Limitation of liability",
    body: "To the maximum extent permitted by applicable law, ATARA LTD is not liable for indirect or consequential losses arising from user error, irreversible blockchain transactions, unsupported assets, third-party outages, or circumstances outside our reasonable control. Nothing excludes liability that cannot lawfully be excluded.",
  },
  {
    title: "13. Suspension and termination",
    body: "We may suspend or terminate access to ATARA-operated services where required for security, legal compliance, abuse prevention, or material breach of these Terms. Account deletion is available from the Profile section of the app, subject to lawful retention requirements and the permanence of public blockchain records.",
  },
  {
    title: "14. Changes",
    body: "We may update these Terms as ATARA develops. We will make the current version available through the Service and update the last-updated date.",
  },
  {
    title: "15. Governing law",
    body: "These Terms are governed by the laws of England and Wales. Mandatory consumer rights and mandatory jurisdiction rules that apply where you live remain unaffected.",
  },
  {
    title: "16. Contact",
    body: "ATARA LTD, 71-75 Shelton Street, Covent Garden, London, United Kingdom, WC2H 9JQ — support@atara.finance",
  },
];
