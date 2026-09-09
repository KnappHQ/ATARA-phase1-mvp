# Security policy

ATARA is in beta and currently uses Base Sepolia test assets. Do not use the beta to hold or transfer real value.

## Reporting a vulnerability

Report suspected vulnerabilities privately to `security@atara.finance`. Include the affected version, reproduction steps, impact, and any relevant transaction hash or public address. Never send a seed phrase, private key, passkey export, service-account key, API token, or personal identity document.

Please allow the maintainers a reasonable period to investigate and coordinate a fix before public disclosure. ATARA does not currently operate a paid bug-bounty program.

## Scope priorities

- authentication bypass or account takeover;
- signer/smart-account ownership confusion;
- unauthorized payment or Vault execution;
- replay, duplicate settlement, or amount/asset mismatch;
- secret exposure in builds, logs, CI, or source;
- privacy leaks involving contacts, groups, or account metadata.

The source repository and issue tracker are not appropriate places for secrets or unpatched vulnerability details.

