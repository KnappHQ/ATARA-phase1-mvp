# Stabilisation du build TestFlight issu de la PR #67

Étude et correctif du 1er octobre 2026, sur `release/store-beta`
(branche `claude/onchain-verification-fix-k0es7a`).

Constat sur iPhone : l'envoi fonctionne (**et n'a pas été touché**) ; « Plans & Miles »
et « ATARA Card » s'ouvrent sans rien afficher ; MoonPay ne fonctionne toujours pas.

Légende : **[code]** lu ou démontré par un test ; **[déduit]** conclusion logique, non
observée ; **[à vérifier]** ne peut être confirmé que sur l'iPhone ou sur Render.

---

## 1. Plans & Miles et ATARA Card « vides » — cause exacte

**Cause [code] : ce n'est pas le backend.** `app/_layout.tsx` tenait une liste
`PROTECTED_ROUTES`. Quand une personne connectée ouvre une route absente de cette
liste, le layout (a) **remplace toute la pile de navigation par un écran noir avec un
spinner** et (b) lance `router.replace("/(tabs)")` dans une pile qui n'est plus montée.
`plans` et `card` étaient des fichiers de `app/` mais **n'étaient pas dans la liste** :
je les avais ajoutés dans #67 sans les y mettre. Les écrans n'ont donc jamais été
dessinés, quel que soit l'état de l'API. C'est mon oubli, et mes tests de #67 ne
vérifiaient pas la navigation.

**Reproduit par un test, pas seulement par la lecture** : retirer `plans` et `card` de la
liste fait échouer `scripts/route-guard.test.cjs` (« Add these to PROTECTED_ROUTES : card,
plans ») ; les y remettre le fait passer.

**Correctif** : la liste et la décision de redirection vivent dans `utils/routeGuard.ts`
(comportement inchangé), `plans` et `card` y figurent, le layout les enregistre, et un
test énumère les fichiers de `app/` : **tout nouvel écran absent de la liste fait échouer
la CI** au lieu d'arriver sur un iPhone.

**Question posée : les écrans dépendent-ils du backend de #67 ?** Ils en dépendaient pour
leurs *données* (`/plans`, `/subscription/me`, `/card/status`, `/card/waitlist`,
absents du backend de production tant que `main` n'a pas la #67). Le build précédent
n'aurait donc pas pu les remplir même une fois affichés. **Ce n'est plus bloquant** : les
deux écrans affichent désormais leur contenu fixe dans tous les cas et n'y ajoutent
les données du serveur que si elles arrivent. Pas de contournement caché : quand le
serveur ne répond pas, l'écran le dit (« Live details are unavailable right now. This
part of the service is not available yet. », avec « Retry »).

### Ce que montrent les écrans maintenant

| | Toujours affiché | Ajouté si le serveur répond |
|---|---|---|
| **Plans & Miles** | « ATARA Plans » ; **ATARA** « Current plan » ; **ATARA Plus** « Coming soon » ; **ATARA Max** « Coming soon » (boutons « Available soon ») ; **ATARA Miles** : « Miles balance: 0 », « Card rewards coming soon » | solde réel de miles ; avantages **prévus** (« Planned · not active yet ») : multiplicateur de Miles, allocation d'envois à frais couverts, frais de conversion carte plus bas. Le plan courant est celui que dit le serveur |
| **ATARA Card** | « Virtual Visa card — Coming soon » ; « Apple Pay — Coming soon » ; « ATARA Miles — Earn rewards when the card launches. » ; **Notify me** ; « Payment QR » (→ paiement commerçant existant) ; mention « le solde de la carte est détenu par l'émetteur » | état réel de la carte **seulement si** l'émetteur est disponible (jamais aujourd'hui) |

Ni faux numéro de carte, ni Visa « active », ni Apple Pay simulé, ni abonnement simulé :
les tests vérifient qu'aucun de ces éléments ne peut apparaître tant que l'émetteur n'est
pas disponible. **Aucun prix et aucun taux de frais n'est affiché** (non promis).
« Notify me » enregistre la demande côté serveur ; s'il échoue (ancien serveur, hors
ligne), l'app le dit au lieu de faire semblant.

### Robustesse commune (aucun écran blanc)

`utils/loadState.ts` : chaque chargement a une **échéance (12 s)** et ses échecs sont
**des valeurs** classées d'après ce qui est réellement revenu (statut HTTP, absence de
réponse, délai, corps invalide), jamais d'après le texte d'une erreur : hors ligne,
délai, 404 (serveur ancien), 401/403, 5xx, JSON invalide. `utils/subscriptionParsers.ts`
valide chaque corps (une page HTML d'un proxy est « invalid », pas un écran à moitié
rempli). Chaque endpoint est chargé séparément : l'un en échec n'empêche pas les autres.
Sans utilisateur connecté, le chargement conclut « non autorisé » (il ne reste jamais
sur « Loading »).

---

## 2. MoonPay — diagnostic

### Ce qui est établi [code]

1. **La signature est construite correctement.** Elle suit la méthode publiée par
   MoonPay (HMAC-SHA256 de la requête brute, `?` compris, en base64, puis encodée une
   fois en fin d'URL). Elle est validée contre le vecteur de test de la documentation
   MoonPay, et maintenant contre **200 URL aléatoires** : chacune se vérifie, ne contient
   aucun caractère qu'un navigateur réécrirait, se relit à l'identique après analyse par
   `URL`, et son `redirectURL` est encodé **exactement une fois**.
2. **Le code de signature est identique sur `main` (Render) et `release/store-beta`**
   (`git diff` vide sur `onramp.service.ts`, `constants.ts`, `onramp.controller.ts`).
   Hypothèse écartée : « la production tourne avec un ancien code de signature ».
3. **L'app ne modifie jamais l'URL.** Elle la reçoit en JSON et la passe telle quelle à
   `WebBrowser.openBrowserAsync` (test : l'URL ouverte est identique octet pour octet ;
   le code de l'écran ne contient ni `encodeURI`, ni `new URL(`, ni ajout de paramètre).
   Un contrôle (`validateCheckoutUrl`) refuse d'ouvrir une URL qui n'est pas celle du
   bac à sable MoonPay, en https, signature en dernier paramètre.
4. **Aucun secret n'est côté app** (la clé secrète reste dans le backend).
5. Noms de variables attendus par le code (à comparer avec Render, lettre par lettre) :
   `MOONPAY_API_KEY` (clé **publiable**, `pk_test_…`), `MOONPAY_SECRET_KEY` (clé
   **secrète**, `sk_test_…`), optionnelles : `MOONPAY_WIDGET_URL`
   (`https://buy-sandbox.moonpay.com/`), `MOONPAY_CURRENCY_CODE` (`usdc_base`),
   `MOONPAY_BASE_CURRENCY_CODE` (`eur`), `ONRAMP_REDIRECT_URL` (https ou vide). L'environnement
   (sandbox ou live) est choisi par **`ALCHEMY_NETWORK`** (`base-sepolia` → sandbox).
   Aucune variable MoonPay n'est lue côté app (hors `EXPO_PUBLIC_ONRAMP_PROVIDER`, non utilisé
   pour signer).

### Ce qui n'a PAS pu être établi

Je n'ai accès ni à MoonPay (injoignable depuis cet environnement), ni aux variables de
Render. Je **ne peux donc pas dire laquelle des causes restantes** produit « signature check
failed » chez toi. Elles ne sont pas visibles depuis le code :

- la clé secrète et la clé publiable ne viennent **pas de la même application MoonPay**
  (seul MoonPay peut le voir) ;
- une clé collée avec des guillemets, un retour à la ligne **au milieu**, la clé publiable
  dans le champ secret, la clé de webhook (`wk_…`) à la place de la secrète, une clé de
  l'autre environnement : **ces cas-là, oui, sont détectés** (voir ci-dessous).

> Autre point, indépendant de la signature : en bêta (Base Sepolia), **le bac à sable
> MoonPay ne dépose aucun fonds** sur ton wallet (l'écran le dit). « Ça ne marche pas »
> peut aussi vouloir dire « rien n'arrive sur mon solde » : c'est le comportement attendu.
> Acheter de vrais USDC demande des clés live MoonPay (validation de ton entreprise) et
> le mainnet. De même, si la signature passe, le widget peut refuser `usdc_base` s'il n'est
> pas disponible en sandbox : **[à vérifier]**, ce serait une autre erreur que « signature ».

### Comment obtenir la vraie cause (outil livré)

1. **`node scripts/moonpay-doctor.cjs`** (onglet *Shell* du service sur Render) : affiche,
   **sans jamais afficher une clé**, pour chaque variable : présente oui/non, longueur,
   type de clé (préfixe public `pk_test` / `sk_test` / `wk` / autre), l'environnement, et
   la liste des problèmes avec leur correctif (`MP-SECRET-IS-PUBLISHABLE-KEY`, `MP-API-KEY-WRAPPED`,
   `MP-SECRET-ENVIRONMENT`, …). Un `ONRAMP_REDIRECT_URL` non-https ou un code devise inhabituel sont des **avertissements**, jamais des blocages (le code d'avant les acceptait ; ils ne peuvent pas casser une configuration qui marche). Si tout est bon, il construit une vraie URL avec la vraie
   configuration et vérifie qu'elle **se vérifie contre son propre secret**. Il termine en disant
   ce qu'il ne peut pas prouver (l'appariement des deux clés).
2. **Une ligne de log par session** (`moonpay-session-created`) : environnement, hôte, types
   et longueurs de clés, noms des paramètres. Si MoonPay rejette ensuite l'URL, ces lignes
   prouvent que le backend en a produit une et pour quelle configuration. Une configuration
   invalide produit `moonpay-config-invalid` avec les codes. **Aucune valeur de clé, ni
   fragment, ni adresse de wallet** (test : aucun fragment de 6 caractères d'une clé ne figure
   dans le rapport ni dans les logs).
3. **Une référence affichée dans l'app** quand la configuration est en cause :
   « MoonPay is not set up correctly on our side… Reference: MP-SECRET-PREFIX ».
4. **Si le script ne trouve rien** : la cause restante est l'appariement des clés. Dans le
   tableau de bord MoonPay (Developers › API keys), recopie la clé publiable **et** la clé
   secrète du même environnement, et remplace les deux variables.

> Ces outils sont dans le backend : ils n'arrivent sur Render **qu'après la fusion dans `main`**.

---

## 3. MoonPay — retour, délai, boutons

**Cause du « loading bloqué » [code, déduit pour le déclencheur]** : l'écran gardait un
booléen `isOpening` vrai *jusqu'à ce que la promesse du navigateur se termine*. Sur iOS, si le
paiement rend la main à l'app par un lien, cette promesse peut ne jamais se terminer : le
bouton restait en spinner. De plus, **rien ne rafraîchissait le solde au retour**.

**Correctif** (`utils/onrampFlow.ts`, machine à états testée) :
`idle → creating → open → returned`, `failed` depuis n'importe quel pas.
- Seul `creating` affiche un spinner, avec une **échéance de 15 s** (puis message et bouton
  libre).
- `open` n'est **pas** occupé : plus rien n'attend le navigateur. Revenir dans l'app
  (`AppState` actif), fermer le navigateur, ou « I'm back » passe à `returned`.
- Au retour, le solde est relu à 0, 5, 15 et 30 s, **puis on s'arrête** ; une confirmation
  tardive apparaît dans Activity. Un test vérifie qu'**aucun état ne reste occupé** (exploration
  exhaustive de séquences d'événements).
- Chaque issue existe : fermeture, annulation, délai, erreur (avec référence), succès.
- Une URL non conforme (hôte, schéma, signature absente ou non finale) n'ouvre rien.

**Boutons / zone sûre** : l'écran « Add crypto » est dans `SafeAreaView` (haut et bas), son
bouton retour fait 44 pt avec `hitSlop` et un label d'accessibilité. Le navigateur de checkout est
en **plein écran avec le bouton Close natif** de Safari (`dismissButtonStyle: close`) : ses boutons
sont ceux de Safari et suivent donc l'encoche et la Dynamic Island. Je n'ai pas pu vérifier **sur
un iPhone** que « trop hauts » ne concernait pas la page MoonPay elle-même (dans ce cas, c'est leur
page, pas l'app) : **[à vérifier]**.

---

## 4. Vault

Déjà **masqué** : `EXPO_PUBLIC_ENABLE_VAULTS=false` dans tous les profils `eas.json`,
`ENABLE_VAULTS=false` sur Render, onglet sans lien, carte d'accueil conditionnée, et
chaque écran Vault protégé par le même indicateur (un test le vérifie). Rien n'est supprimé.
Ce que j'avais ajouté dans #67 autour de Vault est **retiré** : plafond de création
(l'écran `vault-create` est revenu exactement à son état d'avant #67), limites de Vault dans
les offres et dans l'API `/plans`. Aucun écran des offres ne mentionne Vault.

---

## 5. Ce qui n'a pas été touché

Aucun fichier du flux d'envoi, de la confirmation de paiement, des contacts, d'Activity, de
l'authentification, du paiement QR ou des groupes n'est modifié (vérifié par `git diff`).
Le seul fichier racine touché est `app/_layout.tsx`, pour sortir la liste des routes : la
décision de redirection est inchangée (tests : déconnecté → onboarding, connecté qui quitte
l'onboarding → onglets, route inconnue → onglets).

---

## 6. Prêt à fusionner vers `main` ? — état exact

**Compatibilité du build TestFlight actuel avec le backend de production (`main`)** :
avec ce correctif, l'app **fonctionne sans** le backend de #67 (écrans visibles, « not
available yet »). Pour que les données **réelles** (miles, liste d'attente) existent, le
backend de #67 doit être en production.

**Ce qui changerait sur Render si `release/store-beta` est fusionné dans `main`** :
- Code backend, **uniquement additif** : routes `GET /plans`, `GET /subscription/me`,
  `GET /card/status`, `POST /card/waitlist`, `POST /card/webhook/:provider` (refusé : 503
  tant qu'aucun fournisseur n'est configuré), champ `commit` du health check (#63), code de
  diagnostic dans les erreurs MoonPay, journalisation MoonPay sans secret, script
  `moonpay-doctor`.
- **Une migration** : `20261001120000_plans_rewards_card` (2 valeurs d'enum `PLUS`/`MAX`, 3
  tables `MilesEntry`, `CardEvent`, `CardWaitlist`). Additive, aucun utilisateur existant
  ne change. Appliquée par `prisma migrate deploy` (`preDeployCommand` **et** `npm start`).
  Testée sur Postgres 16 ; la CI utilise Postgres 17 ; `ALTER TYPE … ADD VALUE` exige
  Postgres ≥ 12 **[à vérifier : version de la base Render]**.
- `render.yaml` et `package.json` : **inchangés** (aucune dépendance ni variable nouvelle).
  Variables **optionnelles** : `PLANS_OVERRIDE_JSON`, `CARD_PROVIDER` (vide = `unavailable` :
  webhook refusé), `CARD_WEBHOOK_SECRET` (bac à sable seulement).
- Deux fichiers `.github` (#63) : un workflow `verify-render-deploy` qui, après chaque
  fusion dans `main`, vérifie que Render sert le bon commit.
- Fusion testée sans conflit (`git merge-tree`). L'historique de la PR #6 fermée reste
  accessible (fusion `ours` sans changement de contenu).
- **Rétrocompatibilité** : les anciennes versions de l'app ne connaissent pas les nouvelles
  routes et n'en sont pas affectées ; `code` est ajouté aux erreurs seulement quand il existe.

**Après la fusion** : vérifier dans les logs de déploiement Render que la migration
s'est appliquée et que le workflow `verify-render-deploy` passe ; lancer
`node scripts/moonpay-doctor.cjs` dans le Shell du service.

## 7. Ce qui nécessite encore quelque chose

- **Rain** : compte partenaire (KYB), clés bac à sable, schéma de signature des webhooks,
  modèle de recharge, pays, interchange ; l'emplacement `rain` reste fermé.
- **Apple** : provisionnement dans l'app pour Apple Wallet (droit spécifique) ; facturation
  des abonnements (StoreKit / RevenueCat) ; rien n'est achetable aujourd'hui.
- **Render** : fusion dans `main` (rien d'autre à configurer) ; clés MoonPay à recopier si
  le script signale un appariement douteux.
- **MoonPay** : clés live + mainnet pour de vrais achats ; en sandbox, aucun fonds n'est déposé.
