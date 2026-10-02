# Revenus, abonnements, miles et carte Visa (Rain / Apple Wallet) — plan et état

Document du 1er octobre 2026. Il dit **ce qui est livré dans le code**, **ce qui est
une hypothèse à vérifier** et **ce que toi (ou un tiers) dois faire** : le code
seul ne peut ni ouvrir un compte Rain, ni obtenir l'accord d'Apple, ni valider la
conformité.

Légende : **[code]** livré et testé ; **[hypothèse]** chiffre ou fait non vérifié,
à confirmer avant de s'y fier ; **[à faire]** démarche hors du code.

Principe de départ (déjà dans `SUBSCRIPTION_FOUNDATION_2026-09-07.md`) : le
portefeuille ATARA reste **utile sans abonnement**. Les offres payantes ajoutent
du confort, des plafonds plus hauts et de la valeur partenaire ; elles ne
retirent pas l'essentiel.

---

## 1. Les sources de revenu, une par une

| # | Source | Qui paie | Quand ATARA est dans le flux | État |
|---|---|---|---|---|
| 1 | **Carte Visa** : part d'interchange de Rain (reversement convenu) | le commerçant, via Visa | à chaque achat par carte | **[à faire]** contrat Rain ; webhook + comptage **[code]** |
| 2 | **Marge de change** sur achats en devise étrangère | l'utilisateur, affichée | achat par carte hors devise du compte | barème **[code]**, application après contrat Rain |
| 3 | **Frais de dépôt / retrait** (achat de crypto, retrait vers banque) | l'utilisateur, affichés | via le prestataire d'on-ramp (MoonPay) | barème **[code]** ; part de revenu à négocier avec MoonPay **[à faire]** |
| 4 | **Abonnements** Plus et Max | l'utilisateur | achat intégré App Store | droits et plafonds **[code]** ; facturation **[à faire]** (§5) |
| 5 | **Frais de swap** (quand les swaps existeront) | l'utilisateur, affichés | par l'agrégateur | barème **[code]**, pas de fonction swap dans l'app aujourd'hui |
| 6 | **Transferts entre utilisateurs** | — | — | **0 %** pour tous : c'est le moteur de croissance, pas une source de revenu |

Ce qui n'est **pas** fait, volontairement : prélever une commission sur les
envois entre utilisateurs. Un envoi est un seul appel au contrat du token ;
ajouter un second appel (la commission) dans le même paquet change ce que la
vérification des paiements reconnaît (`describePendingPayment` n'accepte qu'un
appel). Ce serait faisable, mais c'est un changement du chemin d'envoi, que
je ne modifie pas dans cette étape. Le barème est prêt (`transfer` = 0) pour le
jour où tu le décides.

### Honnêteté sur les chiffres

Aucun des chiffres suivants n'a été observé ; ce sont des **hypothèses de
travail** pour dimensionner, à remplacer par les chiffres des contrats :

- interchange carte consommateur Visa **[hypothèse]** : de l'ordre de 0,5 % à
  1,5 % selon la région et le type de carte (les cartes de débit réglementées en
  Europe sont plafonnées à 0,2 %) ; la part qui revient au gestionnaire de
  programme dépend du contrat Rain **[à faire]**.
- coût d'une opération sponsorisée sur Base **[hypothèse]** : très faible
  (de l'ordre du demi-centime ou moins) ; à mesurer sur le tableau de bord
  Alchemy.
- commission Apple sur les abonnements **[hypothèse]** : 15 % (programme petites
  entreprises) à 30 %.

Exemple de lecture (à refaire avec les vrais chiffres) pour un utilisateur Plus
qui dépense 400 $ par mois par carte : interchange net ATARA à 0,5 % ≈ 2 $, marge
de change sur 30 % de dépenses étrangères à 0,5 % ≈ 0,6 $, abonnement 4,99 $
moins 15 % ≈ 4,2 $, moins le coût de sponsorisation ≈ 0,1 $ → ≈ 6,7 $ par mois.
Un utilisateur Free qui dépense la même somme rapporte ≈ 2,9 $, sans abonnement.
**Le point à protéger** : la carte rapporte même sans abonnement, donc les miles
et la prise en charge des frais doivent **récompenser la dépense**, pas la
subventionner.

---

## 2. Les deux abonnements

> **État affiché dans l'app** : Free est « Current plan » ; Plus et Max sont « Coming soon »
> avec un bouton « Available soon ». **Aucun prix et aucun taux de frais n'est affiché** :
> aucun n'est une promesse tant que le contrat de la carte et la facturation n'existent pas.
> Les avantages affichés sont ceux de la configuration serveur, présentés comme « Planned ·
> not active yet ». Le tableau ci-dessous est la configuration de travail.

Free reste l'offre de base. Deux offres payantes (noms de travail, prix
**proposés**, modifiables sans publier l'app : ils vivent côté serveur) :

| | **Free** | **ATARA Plus** — 4,99 €/mois | **ATARA Max** — 12,99 €/mois |
|---|---|---|---|
| Envois à frais pris en charge / mois | 10 | 60 | illimités (usage raisonnable : 500) |
| Frais pris en charge en plus par dépense carte | 1 envoi par tranche de 50 $ (max +20) | 1 par 25 $ (max +60) | inclus |
| Miles par dollar dépensé | 1 | 2 | 3 |
| Marge de change carte | 0,90 % | 0,50 % | 0,20 % |
| Frais de dépôt / retrait | 0,50 % | 0,30 % | 0,10 % |
| Frais de swap | 0,40 % | 0,25 % | 0,15 % |
| Carte virtuelle (Apple Wallet) | oui | oui | oui |
| Carte physique | — | à confirmer avec Rain **[hypothèse]** | à confirmer **[hypothèse]** |

**Vault n'est dans aucune offre** (décision du 1er octobre 2026). La fonction est
repoussée : elle est désactivée dans tous les builds (`EXPO_PUBLIC_ENABLE_VAULTS=false`
dans `eas.json`, `ENABLE_VAULTS=false` sur Render, onglet et carte d'accueil masqués,
chaque écran Vault protégé par le même indicateur). Aucun plafond de Vault n'est
configuré, affiché ni appliqué ; le code Vault existant n'a pas été supprimé. Les
offres portent sur les Miles, les frais réseau pris en charge et les avantages
carte, pas sur Vault.

Aujourd'hui toutes les opérations sont sponsorisées (comportement conservé) : les
chiffres « envois à frais pris en charge » du tableau sont **prévus**, pas appliqués.

---

## 3. Les miles et la prise en charge des frais

« À partir d'un certain montant déjà dépensé » se traduit en deux mécanismes
distincts, pour que ce soit lisible :

1. **Allocation du mois** : chaque mois, un nombre d'envois dont ATARA paie les
   frais (colonne « Envois à frais pris en charge »). La dépense par carte du mois
   **ajoute** des envois (une par tranche de dépense, avec un plafond). C'est le
   « palier de dépense » : plus tu utilises la carte, plus tes frais sont couverts.
2. **ATARA Miles** : monnaie de fidélité gagnée sur chaque dépense carte
   (1, 2 ou 3 par dollar selon l'offre). Un mile se dépense contre un envoi à frais
   pris en charge **au-delà** de l'allocation (20 miles l'envoi **[hypothèse de
   barème]**). Les miles n'expirent pas tant que le compte est actif ; ils ne sont
   ni transférables ni convertibles en argent (ce ne sont pas un actif financier).

Règles de comptabilité **[code]** (`backend/utils/miles.ts`,
`backend/services/rewards.service.ts`) :
- un registre en **écritures signées** (gain / dépense) : le solde est la somme,
  jamais un champ réécrit ;
- un événement de dépense a un identifiant de la source (l'identifiant de
  transaction de Rain) **unique** : le rejouer (le webhook peut arriver deux fois)
  ne crédite rien de plus ;
- un remboursement ou une annulation crée une écriture négative liée à l'événement
  d'origine ; le solde peut descendre à 0 mais pas en dessous ;
- le décideur de sponsorisation (`decideSponsorship`) est une fonction pure :
  allocation d'abord, miles ensuite, sinon « à la charge de l'utilisateur », avec
  la raison affichée à l'utilisateur.

Ce qui n'est **pas** branché : le décideur n'est pas encore appelé par le chemin
d'envoi (voir §2, sponsorisation), parce que le faire sans la règle côté Alchemy
reviendrait à un contrôle que le client peut ignorer, et qu'un faux refus
bloquerait un paiement. L'écran « Plans & Miles » affiche l'état (solde, dépense du mois, envois couverts) ; il ne coupe rien. Les envois « utilisés » sont ceux qu'ATARA a enregistrés ce mois-ci pour le compte.

---

## 4. La carte Visa dans Apple Wallet (Rain)

Choix : **Rain** émet la carte Visa ; l'utilisateur l'ajoute à **Apple Wallet**
(plus pratique que le QR code pour payer). Le **QR code reste** : pour un
commerçant qui préfère la crypto ou un pays où la carte n'est pas disponible,
l'écran « Pay a merchant » est inchangé et reste accessible.

### Ce qui est livré **[code]**
- `CardProvider` : une interface (créer le titulaire, demander l'émission, lire
  l'état, fournir les données de provisionnement Apple Wallet, normaliser les
  événements de dépense). Deux implémentations : `sandbox` (déterministe, pour
  tester et pour la démo) et `rain` **non activée tant que les identifiants ne sont
  pas configurés**. Je n'ai pas inventé les chemins ni les formats de l'API Rain :
  je n'y ai pas accès depuis cet environnement et je ne les connais pas avec
  certitude. L'implémentation réelle se branche sur l'interface en suivant leur
  documentation.
- `POST /api/v1/card/webhook/:provider` : reçoit les événements, **vérifie la
  signature sur le corps brut avant toute lecture** (HMAC-SHA256, comparaison à
  temps constant, en-tête `x-atara-signature` pour le bac à sable — le schéma de
  Rain est à implémenter d'après leur documentation), refuse sans signature
  valide, normalise l'événement en quelques champs (pas de numéro de carte, pas de
  commerçant), crédite les miles de façon idempotente. La route est montée avant
  le limiteur par IP (les webhooks viennent d'une infrastructure partagée) avec
  son propre quota. Sans fournisseur configuré, ou si le fournisseur de l'URL
  n'est pas le fournisseur configuré : 503. Le fournisseur `rain` refuse tout
  tant qu'il n'est pas implémenté ; `sandbox` est refusé en production.
- `GET /api/v1/card/status`, `POST /api/v1/card/waitlist` : l'écran « Carte » montre « bientôt
  disponible » et mesure la demande (pays en code à deux lettres, jamais du texte
  libre) tant que Rain n'est pas branché. Supprimé avec le compte.
- L'app : écran **Carte** (état, frais de ton offre, mention « le solde de la carte
  est détenu par l'émetteur », lien vers le paiement par QR), écran **Plans &
  Miles** (offres, ton offre, solde de miles, allocation du mois), entrée « ATARA
  Card » sur l'accueil à côté du paiement par QR, ligne dans Profile. Le bouton
  « Ajouter à Apple Wallet » n'existe pas encore : il n'a de sens qu'avec le
  provisionnement de l'émetteur.

### Ce qui change pour la promesse « non custodial » **[à décider]**
Aujourd'hui, ATARA ne détient jamais les fonds. Avec une carte, l'argent dépensé
doit être **chez l'émetteur** (ou dans un contrat de garantie qu'il contrôle) au
moment de l'achat. Ce n'est pas un détail : l'écran doit dire, en toutes lettres,
« Le solde de la carte est détenu par l'émetteur de la carte, pas dans ton wallet
ATARA ; tu choisis le montant que tu y envoies et tu peux le retirer ». Le
principe à garder : **l'utilisateur choisit et signe chaque recharge** ; aucun
prélèvement automatique dans son wallet sans sa signature. Le code de l'écran
Carte contient ce texte ; il ne contient aucune recharge, parce que le mécanisme
dépend du modèle de Rain **[à faire]**.

### Démarches **[à faire]** — dans cet ordre
1. **Rain** : ouvrir un compte partenaire, passer leur validation de l'entreprise
   (KYB), obtenir le bac à sable (clé d'API, secret de webhook), demander : pays
   couverts, modèle de garantie et de recharge, barème d'interchange reversé,
   cartes physiques, KYC des titulaires (qui le fait, avec quel prestataire),
   frais de programme, délais de remboursement.
2. **Apple Wallet** : l'ajout d'une carte depuis une app s'appelle
   *provisionnement dans l'app* ; Apple le réserve aux émetteurs qui ont obtenu
   un droit spécifique. Demander à Rain s'ils couvrent ce droit pour ton app ou si
   tu dois le demander à ton nom **[hypothèse]**. Sans lui, l'utilisateur ajoute
   la carte à la main (saisie du numéro) — utilisable, moins fluide.
3. **Juridique** : conditions d'utilisation de la carte, politique de
   confidentialité (données du titulaire partagées avec Rain), statut d'ATARA
   (gestionnaire de programme ou simple apporteur) selon ce que dit le contrat.
   Le modèle économique dépend de ce statut. À faire relire par un juriste
   spécialisé paiements.
4. **Abonnements** : décider la facturation (§5).
5. **Prix et barèmes** : valider les tableaux du §2 ; ils se changent côté
   serveur (`PLANS_OVERRIDE_JSON`) sans publier l'app.

---

## 5. Facturer les abonnements

Un abonnement qui débloque des fonctions **dans l'app** doit passer, sur iOS, par
l'achat intégré d'Apple (règle 3.1.1) **[hypothèse : à reconfirmer, des
exceptions existent selon le pays]**. Le moyen le plus court est un service qui
gère les achats et envoie des événements au serveur (RevenueCat ou StoreKit 2 avec
notifications serveur d'Apple). Le serveur ne fait confiance qu'à ces événements
**signés**, jamais à l'app ; il met à jour `subscriptionTier` et
`subscriptionStatus` de façon idempotente.

Livré **[code]** : les droits sont calculés côté serveur à partir des champs
existants (`resolveEntitlement`) : un abonnement `ACTIVE` ou `GRACE_PERIOD` non
expiré donne les droits de son offre ; tout le reste (expiré, annulé, en pause,
inconnu) retombe sur Free. Aucune route client ne peut promouvoir un compte : `/plans`,
`/subscription/me` et `/card/status` sont en lecture seule, et un test
d'intégration vérifie que ni `PATCH /user/me` ni un POST/PUT ne change l'offre.

Non livré : l'achat lui-même. L'écran Plans & Miles affiche les offres, l'état courant et
« Bientôt disponible » sur le bouton tant que `EXPO_PUBLIC_BILLING_ENABLED`
n'est pas activé.

---

## 6. Ce que touche ce changement, et ce qu'il laisse intact

- **Intact** : le chemin d'envoi, la vérification des paiements, la
  sponsorisation actuelle (tout est sponsorisé), le paiement commerçant par QR, le
  contrat Vault (et son masquage), `paymentProof.service.ts` (« fail-closed »).
- **Ajouté** : barèmes et droits (purs, testés), registre de miles, adaptateur de
  carte, routes `/plans`, `/subscription/me`, `/card/*`, trois tables (registre
  de miles, événements de carte, liste d'attente), deux valeurs d'offre
  (`PLUS`, `MAX`), écrans Plans & Miles et Carte. (Un plafond de Vault avait été ajouté à l'écran de
  création puis retiré : cet écran est revenu à son état d'avant.)
- **Compatibilité** : `PREMIUM` (l'ancienne valeur, jamais attribuée) est lue comme
  `PLUS`. Aucun utilisateur existant ne change d'offre.

## 7. Décisions qui sont à toi

1. Prix et noms des deux offres (§2). 2. Free : 10 envois sponsorisés par mois,
est-ce assez généreux pour convaincre sans donner trop ? 3. Prélever ou non une
commission sur les envois entre utilisateurs (je recommande **non**, §1).
4. Modèle de recharge de la carte et wording « non custodial » (§4).
5. Cartes physiques : oui ou non, dans quelle offre. 6. Pays visés au lancement
(Rain, Apple et la réglementation en dépendent).

## 8. Déploiement

- **Render** : ce changement ajoute une migration Prisma (valeurs d'enum et
  trois tables) exécutée par `prisma migrate deploy` au démarrage ; elle a été
  appliquée sur un Postgres 16 local et le schéma ne diverge pas des migrations.
  Après la fusion dans `main`, vérifie dans les logs de déploiement que
  `20261001120000_plans_rewards_card` s'est appliquée. Variables **optionnelles**
  (rien ne casse si absentes) : `PLANS_OVERRIDE_JSON` (prix et plafonds sans
  republier l'app). `CARD_PROVIDER` vaut `unavailable` par défaut (aucun webhook
  accepté) ; `sandbox` (avec `CARD_WEBHOOK_SECRET`) sert aux tests et est refusé
  en production ; `rain` n'est pas encore utilisable. Les variables `RAIN_*`
  ne sont lues par aucun code pour l'instant.
- **TestFlight** : la fusion dans `release/store-beta` déclenche « Store Beta ».
  Les écrans Plans & Miles et Carte s'y trouvent ; les boutons d'achat et de carte
  affichent « Available soon » / « Notify me ».
