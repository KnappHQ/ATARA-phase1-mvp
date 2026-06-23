export const TNC_LAST_UPDATED = "08/05/2026";

export const TNC_FOOTER_TEXT =
  "ATARA UK Ltd — support@atara.finance";

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
    body: 'These Terms of Service ("Terms") govern your use of the ATARA app and website (the "Service"), provided by ATARA UK Ltd, a company registered in England and Wales (company number 17054670). By using ATARA, you agree to these Terms. If you do not agree, do not use the Service.',
  },
  {
    title: "1. Eligibility",
    body: "You must be at least 18 years old and legally able to enter into these Terms. You may not use ATARA if you are located in, or are a resident of, a jurisdiction where use of the Service is prohibited, or if you are subject to applicable sanctions.",
  },
  {
    title: "2. The Service",
    body: "ATARA is a self-custodial crypto wallet built on Base that lets you send and receive funds, including by username. ATARA is a software tool. You are solely responsible for your account, your funds, and your activity.",
  },
  {
    title: "3. Self-custody and your responsibilities",
    body: "ATARA is non-custodial. You control your funds. We do not hold your assets and we cannot reverse, cancel, or recover transactions on your behalf. Blockchain transactions are final and irreversible. You are responsible for verifying recipients and amounts before sending, and for keeping your device and login credentials secure. If you lose access to your account or recovery method, we may be unable to help you recover funds.",
  },
  {
    title: "4. No financial advice",
    body: "ATARA does not provide investment, financial, legal, or tax advice. Crypto assets are volatile and you may lose value. You are solely responsible for your decisions.",
  },
  {
    title: "5. Acceptable use",
    body: "You agree not to use ATARA for any unlawful purpose, including money laundering, terrorist financing, fraud, sanctions evasion, or any activity that violates applicable law. We may suspend or restrict access where we reasonably believe the Service is being used unlawfully or in breach of these Terms.",
  },
  {
    title: "6. Fees",
    body: "Using the Service may involve network fees and/or service fees, which will be disclosed to you where applicable. Network (blockchain) fees are determined by the network, not by ATARA.",
  },
  {
    title: "7. Third-party services",
    body: "ATARA relies on third-party infrastructure (including the Base network and our wallet, hosting, and analytics providers). We are not responsible for the availability, performance, or actions of third-party networks or providers.",
  },
  {
    title: "8. Risks",
    body: "Use of crypto assets and blockchain technology involves significant risks, including volatility, technical failures, and irreversible transactions. Please read our Risk Disclaimer.",
    link: {
      label: "Risk Disclaimer",
      url: "https://atara.finance/risk-disclaimer",
    },
  },
  {
    title: "9. Intellectual property",
    body: "The ATARA name, app, website, and content are owned by ATARA UK Ltd and protected by applicable law. You may not copy, modify, or exploit them without our permission.",
  },
  {
    title: "10. Disclaimers",
    body: 'The Service is provided "as is" and "as available", without warranties of any kind to the maximum extent permitted by law. We do not warrant that the Service will be uninterrupted, secure, or error-free.',
  },
  {
    title: "11. Limitation of liability",
    body: "To the maximum extent permitted by law, ATARA UK Ltd will not be liable for any loss of funds resulting from your own actions, lost credentials, irreversible transactions, third-party network failures, or any indirect or consequential damages. Nothing in these Terms excludes liability that cannot be excluded under applicable law.",
  },
  {
    title: "12. Indemnity",
    body: "You agree to indemnify ATARA UK Ltd against claims arising from your misuse of the Service or breach of these Terms.",
  },
  {
    title: "13. Termination",
    body: "We may suspend or terminate your access if you breach these Terms or where required by law. Because ATARA is self-custodial, you retain control of your funds.",
  },
  {
    title: "14. Changes",
    body: "We may update these Terms from time to time. Continued use of the Service after changes means you accept the updated Terms.",
  },
  {
    title: "15. Governing law",
    body: "These Terms are governed by the laws of England and Wales, and disputes are subject to the exclusive jurisdiction of the courts of England and Wales.",
  },
  {
    title: "16. Contact",
    body: "ATARA UK Ltd — support@atara.finance",
  },
];
