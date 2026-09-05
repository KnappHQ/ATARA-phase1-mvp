# ATARA Vault contracts

Ces contrats ciblent uniquement Base Sepolia (`84532`) pendant la bêta.

```bash
npm install
npm test
npm run abi:check
```

Pour préparer un déploiement, copier `.env.example` vers `.env`, renseigner un
RPC Base Sepolia et une clé de déploiement dédiée, puis lancer :

```bash
npm run deploy:sepolia
```

Le script refuse un autre chain ID, vérifie l’USDC Circle de test et écrit un
manifeste local ignoré par git. Il n’exécute aucun déploiement sans clé fournie
explicitement dans l’environnement.

Après revue du manifeste, reporter l’adresse de la factory dans les variables
frontend et backend indiquées dans `docs/VAULT_PLAN.md`.
