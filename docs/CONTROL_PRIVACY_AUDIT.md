# Ton argent. Ton contrôle. Ta vie privée. — ce que l'architecture garantit

Audit du 28 septembre 2026, sur `release/store-beta` (`61eb5fe`, build 32) et
les changements de la branche `claude/control-privacy-payments`.

Ce document répond, sources à l'appui, à une seule question : **qu'est-ce qui
est vrai aujourd'hui ?** Chaque promesse affichée dans l'app (écran d'accueil,
écran « Control & privacy », politique de confidentialité) doit pouvoir être
retrouvée ici. Ce qui n'est pas encore vrai est dans la section « Limites ».

Règle d'écriture : l'app n'affiche jamais « anonyme », « intraçable » ou
« totalement privé ». Aucune de ces affirmations n'est vraie : les paiements
sont publics sur Base (voir §2).

---

## 1. Contrôle réel des fonds

### 1.1 Qui détient les clés ?

- Chaque compte est un **smart account Alchemy** (type `sma-b`) dont le seul
  propriétaire est un **portefeuille embarqué Privy** créé à la connexion
  (`frontend/providers/PrivyProvider.tsx`, `embedded.createOnLogin` ;
  `frontend/services/smartAccount.service.ts`, `creationHint: { accountType: "sma-b" }`).
- La clé est sécurisée par Privy et utilisée sur le téléphone. **ATARA ne la
  voit jamais** : le backend ne contient aucune clé de signature. La seule clé
  privée du dépôt est celle du déploiement de la factory Vault
  (`contracts/scripts/deploy.mjs`), sans pouvoir après déploiement.
- Le chemin « wallet externe » (Reown), où l'utilisateur détient lui-même sa
  clé, est compilé mais **désactivé en bêta**
  (`frontend/eas.json`, `EXPO_PUBLIC_ENABLE_EXTERNAL_WALLET: "false"`).

### 1.2 ATARA ou un prestataire peut-il déplacer les fonds ?

- **ATARA : non.** Le backend ne construit ni ne soumet aucune transaction ;
  il ne fait que vérifier des reçus déjà sur la chaîne
  (`backend/utils/chainVerifier.ts`, volontairement « fail-closed »).
- **Alchemy** exécute les opérations signées et parraine le gas. Il ne peut pas
  signer à la place du propriétaire.
- **Privy** détient l'infrastructure de clé. Son pouvoir réel dépend de son
  modèle de sécurité (partage de clé, TEE) et ne peut pas être vérifié depuis ce
  dépôt. C'est la principale confiance résiduelle.

### 1.3 Qui peut modifier les règles du portefeuille ?

Personne via l'app : aucun code n'ajoute de propriétaire, de module, de session
key, d'upgrade ni d'allowance sur le smart account. Les contrats ATARA n'ont ni
admin ni upgrade (`contracts/src/AtaraGroupVault.sol`, en-tête).

### 1.4 Si ATARA ferme ou si un prestataire tombe ?

Les fonds restent sur Base, sous la clé de l'utilisateur. Ce que l'app peut
encore faire :

| Panne | Avant cette PR | Après cette PR |
| --- | --- | --- |
| Serveur ATARA injoignable | Aucun paiement possible : chaque envoi exigeait `GET /health/backend` | L'envoi vers une adresse fonctionne ; seul un serveur joignable **sur un autre réseau** bloque (`frontend/utils/networkGuard.ts`, `frontend/services/transaction.service.ts`) |
| Solde (ATARA ou Alchemy en panne) | Le backend répondait « 0 » | Le backend répond 503 (`backend/services/wallet.service.ts`) et l'app lit le solde directement sur Base via un RPC public (`frontend/utils/chainBalance.ts`, `frontend/stores/useWalletStore.ts`) ; si tout échoue : « Balance unavailable », jamais un faux zéro |
| Privy | L'app ne peut plus utiliser la clé | Inchangé (voir §6) |
| Parrainage de gas Alchemy | Paiement refusé | Inchangé : pas de repli payé par l'utilisateur (voir §6) |

Ce qui s'arrête avec le serveur ATARA : @handles, contacts, historique enrichi,
groupes, liens de paiement.

### 1.5 Récupération et portabilité

- **Récupération** : se reconnecter avec la même passkey ou le même compte
  (Apple, Google, email) restaure l'accès au portefeuille Privy.
- **Portabilité** : `@privy-io/expo` 0.72.0 n'expose **aucun export de clé**
  (seul `useImportWallet`, dans l'autre sens). Le compte ne peut donc pas encore
  être utilisé depuis un autre portefeuille. L'écran « Control & privacy »
  affiche désormais l'adresse du propriétaire (signataire) pour qu'on puisse au
  moins vérifier la relation sur BaseScan.

### 1.6 Intégrité de l'adresse affichée

Avant : le serveur fournissait l'adresse du smart account et le téléphone ne la
revérifiait jamais. Un serveur compromis aurait pu afficher une autre adresse
de réception.

Après : le téléphone redérive l'adresse depuis son propre signataire
(`verifyStoredAddress`, `frontend/services/smartAccount.service.ts`). En cas de
différence, l'écran de réception affiche un avertissement rouge et masque le QR
code. Vérification en **lecture seule** : elle ne bloque rien et ne modifie
jamais l'adresse stockée. Si elle ne peut pas aboutir, le statut est
« unverified », pas une erreur.

### 1.7 Garanties pour les portefeuilles existants

Aucun changement ne touche à la dérivation d'adresse, au type de compte, aux
propriétaires ni à l'adresse stockée. Les lectures on-chain sont en lecture
seule. Le blocage en cas de mauvais réseau est conservé.

---

## 2. Vie privée — qui voit quoi

| Donnée | Chaîne Base (tout le monde) | Autres utilisateurs ATARA | Destinataire d'un paiement | ATARA | Prestataires |
| --- | --- | --- | --- | --- | --- |
| Montant, date, adresses d'un paiement | **Oui, pour toujours** | Non (sauf via la chaîne) | Oui | Oui | Alchemy |
| @handle, nom affiché, photo, adresse de réception | Non | **Oui** (recherche ≥ 3 caractères) | Oui | Oui | — |
| Adresse du signataire (propriétaire) | Oui (lien propriétaire ↔ compte) | **Non** depuis cette PR | Non | Oui | Privy |
| Message/catégorie d'un paiement | Non | Non | Oui, s'il utilise ATARA | Oui | — |
| Email | Non | Non | Non | Oui, si fourni | Privy ; **plus MoonPay** |
| Contacts, historique, groupes | Non | Membres du groupe (dépenses du groupe) | — | Oui | — |
| Surnoms donnés aux adresses | Non | Non | Non | **Non** (téléphone seulement) | — |
| Rapports de crash | Non | Non | Non | Via Sentry | Sentry : identifiant opaque, sans adresses, handles, emails ni jetons |

**Ce que cela implique** : quiconque connaît ton @handle peut trouver ton
adresse et suivre tes paiements sur la chaîne. ATARA garde ton nom hors de la
chaîne et partage le moins possible ; il ne rend pas tes paiements anonymes.

### 2.1 Changements de cette PR

| Changement | Où | Apport |
| --- | --- | --- |
| Plus d'adresse du signataire renvoyée sur un autre utilisateur | `backend/services/user.service.ts`, `backend/services/transaction.service.ts` | Confidentialité : la clé qui contrôle un compte n'est plus liée à un @handle |
| Plus de recherche inverse adresse → @handle | `backend/utils/userSearch.ts` | Confidentialité : une adresse vue sur la chaîne ne révèle plus l'identité. Coût : coller une adresse n'affiche plus le @handle correspondant |
| Note et catégorie modifiables par l'expéditeur seul | `backend/services/transaction.service.ts` (`updateTransaction`), `frontend/app/transaction-detail.tsx` | Confidentialité : le destinataire ne peut plus réécrire le message de l'expéditeur, ni lui montrer comment il classe le paiement |
| Lien de paiement : détails publics seulement tant qu'il est payable (+ 24 h après expiration pour confirmer un paiement envoyé à temps), ensuite statut seul ; QR servi seulement pour un lien ouvert | `backend/services/paymentRequest.service.ts`, `backend/public/pay/client.js`, `backend/routers/paymentRequest.routes.ts` | Confidentialité : montant, note et adresse ne restent plus lisibles indéfiniment |
| Connexion/inscription : profil minimal (7 champs) au lieu de la ligne complète ; l'app ne garde que ce profil et réécrit celui des anciennes versions | `backend/services/auth.service.ts`, `frontend/utils/userProfile.ts`, `frontend/stores/useAuthStore.ts` | Minimisation : plus de champs TOTP hérités, de téléphone de récupération ni d'adresse du signataire stockés sur le téléphone |
| MoonPay ne reçoit que l'adresse de livraison | `backend/services/onramp.service.ts` | Minimisation : plus d'email ni d'identifiant ATARA (aucun webhook ne s'en servait) |
| Sentry : identifiant opaque seulement ; breadcrumbs et rapports nettoyés | `frontend/utils/privacyScrub.ts`, `frontend/app/_layout.tsx` | Confidentialité : ni email, ni handle, ni adresse, ni jeton de lien, ni requête de recherche |
| Logs serveur nettoyés (clés API dans les URL, jetons, emails, adresses) | `backend/utils/logger.ts` | Sécurité + confidentialité |
| Presse-papiers lu seulement sur appui « Paste » | `frontend/components/send/ContactsList.tsx` | Confidentialité : l'app ne lit plus ce qui a été copié sans qu'on le demande |
| Surnoms rangés par compte et effacés à la suppression du compte | `frontend/stores/useAddressBookStore.ts`, `frontend/utils/addressBookScope.ts` | Protection des contacts : le compte suivant sur le même téléphone ne les voit plus |
| Suppression de compte : texte des feedbacks et notes des liens payés effacés | `backend/services/user.service.ts` | Minimisation |
| Rappel de remboursement sans lien public, sans nom, sans surnom privé, sans montant | `frontend/app/contact-detail.tsx` | Confidentialité + fiabilité : l'ancien lien ne soldait jamais la dette de groupe et invitait à payer deux fois |
| Textes honnêtes (accueil, identité, lien de paiement, écran « Control & privacy », politique de confidentialité) | `GateScreen.tsx`, `IdentityScreen.tsx`, `ShareModal.tsx`, `app/sovereignty.tsx`, `utils/privacyPolicy.ts`, `backend/routers/legal.routes.ts` | Promesse tenue par l'architecture |

### 2.2 Téléphone

- **Permissions** : aucune permission sensible n'est demandée (ni caméra, ni
  contacts, ni localisation, ni micro, ni photos, ni notifications — `app.json`).
- **Notifications** : l'app n'en envoie pas ; aucune information financière ne
  peut donc apparaître sur l'écran verrouillé.
- **Stockage local** : jeton de session et profil minimal dans le trousseau
  (`expo-secure-store`) ; surnoms dans AsyncStorage, par compte.
- **Analytics** : aucune analytics produit passive en bêta.

### 2.3 Limites par parcours

- **Inscription** : le @handle et le nom affiché sont visibles de tout
  utilisateur connecté (désormais dit à l'écran).
- **Envoyer** : le message est stocké par ATARA et montré au destinataire ;
  montant et adresses sont publics sur Base.
- **Recevoir** : partager son adresse ou son QR code révèle tout l'historique
  public de cette adresse.
- **Lien de paiement** : quiconque a le lien voit montant, note et adresse
  jusqu'au paiement, à l'annulation, ou 24 h après l'expiration.
- **Groupes** : n'importe quel membre peut ajouter un @handle au groupe, ce qui
  expose le nom et l'adresse de la personne ajoutée aux autres membres (sans
  effet sur ses fonds).
- **Achat (MoonPay)** : MoonPay collecte lui-même son KYC, sous sa propre
  politique.

---

## 3. Paiements du quotidien — capacités réelles

| Besoin | Disponible | Comment |
| --- | --- | --- |
| Recevoir | Oui | Adresse copiée, **QR code** (EIP-681 avec réseau, dessiné sur le téléphone), @handle, lien de paiement 24 h |
| Payer une personne | Oui | @handle, adresse collée (sur appui) ou tapée |
| Payer un lien / une requête EIP-681 | Oui | Coller la requête dans « Pay a merchant » |
| Scanner un QR avec la caméra | **Non** | Voir §6 |
| Comprendre avant de signer | Oui | Écran de revue commun : adresse complète par groupes de 4, « Recipient receives », frais réseau (0, payés par ATARA tant que le parrainage est disponible), « Leaves your account », réseau, ce qui est partagé |
| Choisir ce qu'on partage | Oui | Message facultatif, jamais pré-rempli ; indication de qui le voit |
| Statut fiable | Oui | Un paiement soumis mais non confirmé affiche « Status unknown. Do not send again. » et bloque un nouvel envoi depuis cet écran ; le service refuse aussi tout nouvel envoi tant que le précédent n'est pas tranché |
| Commerçants | Partiel | Uniquement ceux qui acceptent l'USDC sur Base et donnent une adresse ou une requête EIP-681. **Pas de carte, de NFC ni de TPE. ATARA ne vérifie pas les commerçants et ne promet pas une acceptation universelle.** |
| Frais | Parrainés | Si le parrainage tombe, le paiement est refusé, jamais facturé en silence |

Aussi corrigé : le devis d'un règlement de groupe est revérifié au moment de la
confirmation (il pouvait expirer pendant la revue).

---

## 4. Permissions et autorisations

**État actuel** :

- Aucun prélèvement automatique, allowance, abonnement ou paiement récurrent
  n'existe dans le build bêta (le seul `approve` du code est celui du Vault, non
  exposé, et il est remis à zéro avant chaque dépôt).
- **Une dette de groupe n'existe qu'après acceptation du débiteur** : la part
  est créée `PENDING` et seul le débiteur authentifié peut l'accepter ou la
  contester (`backend/services/group.service.ts`, `decideSplit`). Seul le
  débiteur signe le règlement.
- Un créancier ne peut ni prélever, ni bloquer, ni « accepter pour » un autre
  utilisateur.
- Aucun agent IA n'a de droit de paiement. `backend/utils/agentAccessPolicy.ts`
  refuse par défaut toute capacité non listée ; seules des lectures sont
  envisagées, et aucune n'est exposée (voir `docs/agent-access-beta.md`).

**Règles pour toute autorisation future** (agents, remboursement automatique,
paiement récurrent) :

1. Donnée **par le seul propriétaire des fonds**, dans l'app, jamais par un
   créancier ni par le serveur.
2. **Explicite et plafonnée** : montant par opération et par période,
   destinataire(s) nommé(s).
3. **Datée** : expiration obligatoire.
4. **Révocable** à tout moment, avec effet immédiat.
5. **Visible** : liste des autorisations actives et journal de leur usage.
6. Toute immobilisation de fonds (Vault) résulte d'un accord explicite de
   chaque membre, avec une issue de secours (voir §6).

---

## 5. Positionnement

« Ton argent. Ton contrôle. Ta vie privée. » est désormais le titre de l'écran
d'accueil et de l'écran « Control & privacy », chaque fois suivi de ce que cela
veut dire et de ses limites.

| Promesse | Ce qui la tient dans le code | Ce qui la limite encore |
| --- | --- | --- |
| Ton argent | Seul le téléphone signe ; le serveur n'a aucune clé ; solde lisible sans ATARA | Privy détient l'infrastructure de clé ; pas d'export |
| Ton contrôle | Payer vers une adresse sans le serveur ATARA ; adresse revérifiée par le téléphone ; aucune autorisation tierce possible ; revue complète avant signature | Parrainage Alchemy obligatoire ; pas de second signataire |
| Ta vie privée | Minimisation serveur, Sentry, MoonPay, logs ; plus de recherche inverse ; liens qui se referment ; surnoms locaux par compte | Paiements publics sur Base ; @handle → adresse visible des utilisateurs connectés |

---

## 6. Limites restantes et suite proposée

| Limite | Pourquoi pas maintenant | Chemin proposé |
| --- | --- | --- |
| Pas de repli de gas payé par l'utilisateur | Retiré en `66fc97c` faute de frais chiffrés avant signature | Estimer les frais, les afficher dans l'écran de revue, demander une confirmation explicite ; tests sur appareil |
| Pas d'export / portabilité de clé | Impossible avec `@privy-io/expo` 0.72.0 | Réactiver la connexion wallet externe, ou ajouter au smart account un second signataire détenu par l'utilisateur (adresse conservée). Décision produit + revue sécurité |
| Dépendance à un seul prestataire RPC/bundler | Architecture actuelle | Plusieurs RPC pour la lecture (déjà possible via `EXPO_PUBLIC_CHAIN_RPC_URL`), bundler de secours |
| Note et catégorie partagées | Migration de schéma nécessaire | Notes privées par personne ; la fuite (écrasement par l'autre partie) est déjà corrigée |
| Pas de scan de QR par caméra | Nouveau module natif + permission caméra | Permission demandée au moment du tap, jamais au lancement ; tests sur appareil |
| Ouvrir un lien ATARA dans l'app et le marquer payé | Non développé | Deep link vers l'écran de revue |
| Ajout à un groupe sans consentement | Non développé | Invitation avec acceptation avant toute exposition |
| Vault : un seul membre peut bloquer retraits et dissolution (unanimité) | Non exposé en bêta | Issue de secours (délai ou quorum) avant toute activation |
| Prix de secours codés en dur (ETH = 3000 $, stablecoins = 1 $) | Affichage seulement ; les montants envoyés sont en jetons | Afficher « prix indisponible » plutôt qu'une valeur inventée |
| Permissions Android par défaut d'Expo non restreintes | À tester sur appareil | `android.blockedPermissions` avant la publication Play Store |

---

## 7. Déploiement

- L'app suit `release/store-beta` (TestFlight). **L'API Render se déploie depuis
  `main`** (`render.yaml`) : les changements backend de cette PR ne seront en
  ligne qu'après la fusion release → `main`.
- Chaque changement app reste compatible avec l'ancien backend dans cet
  intervalle : l'app nettoie elle-même le profil reçu, désactive l'édition de la
  note pour le destinataire et ne lit que le statut des liens.
- Aucun test sur appareil n'a pu être fait depuis l'environnement de
  développement : à valider sur le build TestFlight suivant la fusion.
