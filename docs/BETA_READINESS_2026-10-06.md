# Préparation de la bêta — état au 6 octobre 2026

Légende : **[code]** lu ou démontré par un test ; **[à vérifier]** ne se confirme que sur
iPhone, Render, Alchemy ou chez un tiers. Aucun iPhone n'a été utilisé pour ce document.

## 1. Où en est le dépôt

| Élément | État |
|---|---|
| `main` | `e5fca24` (inclut #71, #74, #75). Render sert ce commit, réseau Base Sepolia |
| `release/store-beta` | `455401b`, ancêtre de `main` : 5 commits de retard, rien d'unique |
| #77 groupes | corrigé (réessai sans doublon), à fusionner **avant** de distribuer un build |
| #78 prix | nouvelle PR, supprime l'ETH à 3 000 $ |
| #76 premier lancement | 371 tests, fusionne sans conflit avec #77 et #78 |
| #73 frais USDC | mise à jour avec `main` (conflit `pay-merchant.tsx` résolu), **ne pas distribuer** sans politique Alchemy |
| Combinaison #76 + #77 + #78 | `tsc`, 382 tests app, `tsc` backend verts. Un test backend (« recent contacts never carry the owner address ») échoue aussi sur `main` sans base de données **[code]** |

**Commit à distribuer** : le sommet de `main` après fusion de #77, #78 et #76 (pas #73), puis
build `beta` depuis ce commit. Fusion à faire par Tanguy.

## 2. Compatibilité anciens builds / serveur

- Render sert déjà `e5fca24` : un ancien build qui ajoute une dépense dans un groupe ayant
  une invitation en attente reçoit un **409 explicite**. Seul un nouveau build avec #77 corrige
  cela **[code]**. Le garde-fou serveur est volontaire (il évite de facturer quelqu'un que
  l'écran montrait comme participant).
- #78 garde les champs numériques historiques (`usdValue`, `usdPrice`, `totalUSD`,
  `change24h`) : un ancien build lit 0 pour une valeur inconnue au lieu d'un faux prix.
- Réseau : `render.yaml` `ALCHEMY_NETWORK=base-sepolia`, profil EAS `beta`
  `EXPO_PUBLIC_NETWORK=base-sepolia`, `/health/backend` annonce `chainId`. L'app refuse déjà un
  paiement si le serveur annonce une autre chaîne (`utils/networkGuard.ts`, appelé dans
  `transaction.service.ts`) et ne bloque pas si le serveur est injoignable (voulu : le téléphone
  signe, le serveur n'est pas dans le chemin des fonds) **[code]**.
- Le preflight refuse désormais un build beta avec `EXPO_PUBLIC_ENABLE_CARD_PURCHASE=true`
  (non défini = faux, ce qui est le cas dans `eas.json`).

## 3. Parcours sensibles : déjà couverts

Ce qui existe et est testé (scripts `frontend/scripts/*.test.cjs`), à ne pas refaire :

- **Paiements** : intention enregistrée avant l'envoi, fermeture ou réseau coupé, preuve
  sur la chaîne si le fournisseur se tait, réenregistrement sans nouvel envoi, deux paiements
  identiques restent deux paiements, isolation par compte et réseau, un statut inconnu n'est
  jamais « échoué » (`payment-submission`, `payment-operations`, `payment-outcome`,
  `pending-operation`).
- **Comptes** : noms, passkeys, changement de compte, retrait du téléphone ≠ suppression ≠
  retrait d'une méthode, dernier accès protégé (`accounts`, `account-screens`).
- **MFA** : l'interface Privy est activée (`PrivyProvider.tsx`, `enableMfaVerificationUIs: true`)
  et l'inscription TOTP est dans `app/security.tsx`. Le parcours complet (inscription, puis
  demande au retrait d'un passkey ou à une signature) **n'a pas été exécuté** : **[à vérifier sur
  iPhone]**.
- **Récupération et portabilité** : décrites dans `docs/CONTROL_PRIVACY_AUDIT.md` §1.5.
  Réalité : se reconnecter avec le même passkey ou compte restaure l'accès ; `@privy-io/expo`
  0.72.0 n'expose aucun export de clé. Options réalisables sans changer le portefeuille en
  silence : réactiver la connexion par portefeuille externe, ou ajouter un second signataire au
  smart account (même adresse). Décision produit et revue de sécurité nécessaires.

## 4. Fonctionnalités manquantes

| Fonction | État |
|---|---|
| Collage d'une demande de paiement | présent (`pay-merchant.tsx`) |
| Scanner QR avec caméra | absent (`expo-camera` non installé) |
| Ouverture d'un lien de paiement dans l'app | absent : le lien ouvre la page web ; le serveur donne déjà l'état (`OPEN/PAID/CANCELLED/EXPIRED`) ; AASA ne déclare que `webcredentials`, pas `applinks` |
| Frais en USDC | PR #73, code prêt, bloquée par la politique Alchemy |
| Carte Rain | `provider.ts` : `rain` se déclare non configuré ; aucune API Rain n'est inventée |
| Abonnements Plus/Max, Miles | écrans « Coming soon », Vault désactivé |

## 5. Démarches externes

- **Alchemy** : politique ERC-20 Base Sepolia pour l'USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
  (post-opération), puis remplacer `EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID` ; garder l'ancienne
  politique active tant que d'anciens builds circulent ; validations Base Sepolia de
  `docs/NETWORK_FEES.md` (PR #73).
- **Rain** : contrat de programme, accès sandbox et clés, documentation officielle du
  webhook (signature), du modèle de détention des fonds et des remboursements, puis capacités
  Apple Wallet accordées. Sans cela rien n'est implémentable honnêtement.
- **Apple** : pour les liens de paiement, `applinks:api.atara.finance` côté app et `applinks` dans
  l'AASA (`APPLE_TEAM_ID` est déjà posé sur Render) ; provisioning Apple Pay pour la carte ;
  achats intégrés ou autre règle de facturation à trancher avant tout abonnement.
- **Render** : vérifier `ALCHEMY_API_KEY`, `PUBLIC_PAYMENT_ORIGIN`, `ENABLE_VAULTS=false`,
  `ENABLE_MAINNET_PAYMENT_REQUESTS=false` ; après fusion, confirmer le commit servi via
  `/api/v1/health/backend`.
- **Facturation** : règles applicables aux abonnements et à la monnaie de fidélité, à valider
  avec un conseil avant de fixer des prix à partir des coûts réels.

## 6. Checklist iPhone (petit modèle inclus)

1. Groupe avec un membre accepté et une invitation en attente : dépense égale puis
   personnalisée, seuls les membres acceptés ont une part ; couper le réseau pendant l'envoi,
   réessayer : une seule dépense.
2. Clé Alchemy de prix bloquée ou fausse : l'USDC garde son montant, une note dit « counted at $1 »,
   l'ETH affiche « Unavailable », pas de variation sur 24 h.
3. Premier lancement : règles du @handle, brouillon conservé après fermeture, Retour demande
   confirmation, aucun brouillon d'un compte chez l'autre.
4. Barre d'onglets sur iPhone SE/mini : « Pay » (cercle et mot) ouvre Send.
5. Paiement : mode avion pendant l'envoi, rouvrir l'app, état « Sending » jamais « failed ».
6. MFA : activer, puis retirer un passkey ou signer.
7. Solde réel de 0 : « 0 », pas de squelette de chargement.

## 7. Blocages restants

La bêta n'est **pas** prête tant que #77 et #78 ne sont pas fusionnées et distribuées, que les
vérifications iPhone ci-dessus n'ont pas été faites, et que la politique Alchemy n'existe pas
(pour #73). Scanner QR, liens de paiement, Rain et abonnements ne sont pas livrés.
