# Comptes et passkeys — reconnaître, renommer, retirer, supprimer

Étude et correctif du 29 septembre 2026, sur `release/store-beta`
(branche `claude/manage-accounts-passkeys`).

Problème d'origine : le sélecteur de connexion iOS affichait plusieurs entrées
identiques « ATARA — Clé d'accès ». Avec plusieurs comptes sur un même iPhone,
impossible de savoir laquelle ouvre quel compte, de la renommer ou de retirer
celles dont on n'a plus besoin.

Ce document dit **ce qui est vrai** : ce qui a été lu dans le code, ce qui est
déduit, ce qui n'a pas pu être observé, et ce qui doit être testé sur un iPhone.
Il n'y a pas de section « Limites » à part : chaque affirmation dit d'où elle
vient.

Légende : **[code]** lu dans le code du dépôt ou de `node_modules` ;
**[déduit]** conclusion logique, non observée ; **[à tester]** ne peut être
confirmé que sur un iPhone.

---

## 1. Pourquoi toutes les entrées s'appelaient « ATARA »

Chaîne complète d'un passkey créé avant ce correctif :

1. **ATARA** appelait `signupWithPasskey({ relyingParty })` et
   `loginWithPasskey({ relyingParty })` sans aucun nom
   (`frontend/providers/AuthProvider.tsx`, ancienne `startPasskey`). **[code]**
2. **`@privy-io/expo` 0.72.0** demande à Privy des options WebAuthn
   (`generateSignupOptions`), dont un bloc `user: { id, name, display_name }`,
   puis appelle `react-native-passkeys.create({ ...extra_options, rp, user,
   challenge, pubKeyCredParams, … })`. `extra_options` est étalé **avant** `rp`,
   `user` et le reste : ce que l'app passe ne peut rien écraser. **[code]**
   (`dist/passkey.js` et `dist/chunk-HUHULZRX.js` : fonctions `Mm` et `ii`.)
3. **`react-native-passkeys` 0.4.1**, chemin iOS « plateforme »
   (`ios/ReactNativePasskeysModule.swift`, l. 219-222) :
   `createCredentialRegistrationRequest(challenge:, name: request.user.name,
   userID:)`. iOS liste un passkey par ce `name`. `displayName` n'est transmis
   que sur le chemin « clé de sécurité » (l. 173-176). **[code]**
4. Le `user.name` vient **tel quel** de la réponse du serveur Privy. Toutes les
   entrées portent « ATARA », donc Privy propose une valeur constante.
   **[déduit]** — `auth.privy.io` est injoignable depuis l'environnement où ce
   travail a été fait : la valeur exacte renvoyée n'a pas été observée.
5. Ce nom n'est **pas signé** et **n'est pas renvoyé à Privy** :
   `signupWithPasskey` (`@privy-io/js-sdk-core` 0.73.0) ne poste que
   l'attestation, le `clientDataJSON` et l'identifiant du credential. **[code]**
   On peut donc construire l'appel nous-mêmes avec un autre nom sans changer ce
   que Privy vérifie.

Le `user.id` (identifiant utilisateur WebAuthn) est différent pour chaque
inscription : c'est pour cela que plusieurs entrées « ATARA » **coexistent**
au lieu de se remplacer. **[déduit]**

## 2. Ce que les SDK permettent, et ce qu'ils ne permettent pas

| Besoin | Réponse | Conséquence dans ATARA |
|---|---|---|
| Nommer un passkey à la création | Pas avec le hook `useSignupWithPasskey` (voir §1.2). Oui en appelant les mêmes méthodes du client Privy soi-même. **[code]** | `services/passkey.service.ts` reproduit les appels du SDK, dans le même ordre ; seul `user.name` / `displayName` change. `user.id`, `rp`, `challenge`, `excludeCredentials` sont copiés tels quels. |
| Renommer un passkey **existant** | Aucune API dans Privy, dans `react-native-passkeys`, ni pour une app tierce sous iOS. **[code]** | Impossible depuis ATARA. Voir §6. |
| Savoir **quel** passkey a servi à se connecter | Le hook ne le dit pas. **[code]** | ATARA exécute lui-même la connexion ciblée : il connaît l'identifiant du credential utilisé. |
| Ne proposer qu'**un** passkey à la connexion | `allowCredentials` est transmis à iOS (`allowedCredentials`, l. 422-428). **[code]** | « Switch » n'affiche que le passkey du compte visé. |
| Retirer un passkey d'un compte | `useUnlinkPasskey().unlink({ credentialId })`. Exige une vérification MFA et « au moins un autre compte lié » — or **le portefeuille embarqué compte comme compte lié**. **[code]** | ATARA applique une règle plus stricte (§5.B) avant d'appeler Privy. |
| Supprimer le passkey **dans iOS** | Aucune API. | Il faut passer par Réglages › Mots de passe. L'app l'explique et n'affirme jamais l'avoir fait. |
| Plusieurs utilisateurs Privy sur l'appareil | `useSwitchUser` existe mais est expérimental et exige `sessions.mode: "multi-user"`, non activé. **[code]** | Non utilisé : « Switch » est une déconnexion suivie d'une connexion. |

Ajouter un deuxième passkey à un compte, sur un iPhone qui a déjà le premier :
`react-native-passkeys` transmet `excludedCredentials` à iOS ≥ 17.4
(l. 280-286) et Privy y met tous les passkeys déjà liés. iOS doit donc **refuser**
d'en créer un second pour le même compte dans le même trousseau. **[code]** /
**[à tester]** — refus sans effet destructeur.

## 3. Le modèle : deux noms, des identifiants stables

### 3.1 Deux noms qu'il ne faut pas confondre

| | Nom **privé** (sur cet iPhone) | Identité **publique** |
|---|---|---|
| Exemple | « Tanguy — Tests » | `@tanguy41`, « Tanguy » |
| Où | Sur l'iPhone, et dans le libellé du passkey que garde iOS | Serveur ATARA |
| Qui le voit | Le propriétaire du téléphone | Les autres utilisateurs d'ATARA |
| Reçu par ATARA / Privy ? | **Jamais** | Oui |
| Sert à | Reconnaître un compte dans le sélecteur iOS et dans « Manage accounts » | Se faire trouver et payer |

### 3.2 Association par identifiants stables

Un compte est retrouvé par son **identifiant utilisateur Privy** d'abord, son
**identifiant utilisateur ATARA** ensuite. Un passkey appartient à un compte
parce que Privy le liste sous cet utilisateur, ou parce qu'ATARA l'a créé pendant
que cet utilisateur était connecté. Jamais d'après l'ordre des entrées, leur nom
ou leur date (`utils/accountRegistry.ts`, `findAccount`). Les libellés, @handles
et dates ne servent qu'à l'affichage.

### 3.3 Le registre local

`stores/useAccountRegistryStore.ts`, clé `atara-account-registry` (AsyncStorage,
sur le téléphone seulement). Par compte : clé locale aléatoire, identifiants
Privy et ATARA, @handle et adresse (copie affichée), nom privé, passkeys connus
(identifiant, nom donné à iOS, date de création, dernière vérification sur ce
téléphone, origine « atara » ou « existant »), dates.

- **Aucun endpoint, aucune requête ne le transporte.** Le backend n'est pas
  modifié par ce correctif. Des tests le vérifient (`scripts/accounts.test.cjs`,
  « the private name and the account list never go to the ATARA API »).
- Il n'est **pas vidé** par une déconnexion ni par un changement de compte
  (sinon on ne pourrait plus revenir à un compte) ; seul « Remove from this
  iPhone » retire une entrée.
- L'écran de connexion **ne lit pas** cette liste : il est atteignable avant
  toute authentification. La seule exception est le compte que la personne vient
  de choisir dans « Switch » (mémoire vive uniquement).
- Il n'est **pas synchronisé** entre appareils : sur un deuxième appareil, la
  liste se remplit à mesure qu'on s'y connecte. Elle disparaît si l'app est
  désinstallée ; les comptes sont alors reconnus de nouveau à la prochaine
  connexion (§6).

### 3.4 Création d'un compte

1. Le Gate demande un **nom privé** avant de créer le passkey (« Name this
   account »). Proposition par défaut : `Account` + 4 caractères sans ambiguïté
   (pas de 0, O, 1, I, L). Le @handle n'existe pas encore à cette étape.
2. Le nom est validé : non vide, ≤ 40 caractères, sans caractère invisible ni
   contrôle bidirectionnel, **unique** parmi les comptes et les passkeys de ce
   téléphone (sans tenir compte de la casse, des accents ni des espaces), et
   **différent de « ATARA »** — le nom que iOS affiche déjà pour les anciens
   passkeys.
3. iOS crée le passkey sous ce nom ; Privy le lie à un nouvel utilisateur.
   L'entrée locale est créée **tout de suite**, liée à l'identifiant Privy et à
   l'identifiant du credential : « Setup not finished » tant qu'il n'y a pas de
   @handle.
4. Après l'écran de @handle, le profil ATARA est créé ; la synchronisation du
   registre complète l'entrée (identifiant ATARA, @handle, adresse). Si le passkey
   est créé mais que Privy ne l'accepte pas, l'app le dit **par son nom** : il ne
   fait rien et peut être supprimé dans Mots de passe.

Le nom **ne peut plus être modifié dans iOS** après la création (§2).

## 4. « Manage accounts » (Profil › Manage accounts)

- Liste des comptes connus sur l'iPhone, compte actif signalé « Active »,
  avec nom privé, @handle (ou « Setup not finished » / « ATARA profile
  deleted »), adresse abrégée, et — pour retrouver le passkey dans iOS — le nom
  donné à iOS, ou la mention « créé avant les noms ; iOS le liste probablement
  comme “ATARA” ».
- **Rename** : nom privé seulement. La feuille dit que l'entrée iOS n'est pas
  renommée et rappelle le nom que iOS garde.
- **Switch** : voir §4.1.
- **Add another account** : déconnexion, puis le Gate (créer avec un passkey
  nommé, ou se connecter à un compte existant). Les autres comptes restent
  dans la liste.
- **Remove from this iPhone**, **Passkeys & sign-in**, **Delete ATARA account** :
  §5.

### 4.1 Changer de compte

« Switch » = déconnexion du compte actif, puis connexion au compte choisi,
**confirmée par son propre moyen** :

- passkey connu → connexion **ciblée** (un seul passkey proposé à iOS, Face ID
  ou code) ;
- compte créé avec Google/Apple → ce fournisseur ;
- sinon → le choix habituel.

Après la connexion, ATARA vérifie par l'identifiant Privy qu'on est bien arrivé
sur le compte demandé. Si un passkey ouvre en réalité un autre compte que celui
que la liste annonçait, l'app le dit et **corrige la liste** (elle retire ce
passkey du mauvais compte).

Isolation (déjà en place, vérifiée par test de code) : la déconnexion vide les
soldes (`useWalletStore.reset`) et les caches contacts, groupes, historique,
vérifications d'adresse et surnoms (`resetAccountScope`) ; les surnoms sont un
carnet **par compte**. Les paiements non terminés restent attachés à leur compte
(file de règlement par utilisateur, opération en cours par adresse de smart
account) et reprennent à la reconnexion : un changement de compte ne les efface
pas.

## 5. Trois suppressions, trois choses différentes

| | A. Retirer de cet appareil | B. Supprimer une méthode de connexion | C. Supprimer le compte ATARA |
|---|---|---|---|
| Écran | Manage accounts › Remove from this iPhone | Passkeys & sign-in › Remove | Manage accounts ou Profil › Delete ATARA account |
| Ce qui est supprimé | L'entrée dans la liste de cet iPhone ; la session (si actif) ; les surnoms de ce compte sur cet iPhone | Le lien entre **ce passkey** et le compte, chez Privy | Le profil sur le serveur ATARA (§5.C) |
| Ce qui **n'est pas** touché | Le compte ATARA, le wallet, les fonds, le passkey dans iOS, les paiements non terminés | Le compte, le wallet, les fonds, **la copie du passkey dans iOS** | Les fonds (on-chain), les passkeys, le wallet chez Privy |
| Réversible ? | Oui : se reconnecter avec le passkey recrée l'entrée | Ajouter un autre passkey / méthode | Non pour le profil ; on peut recréer un profil pour le même wallet |
| Garde-fou | Confirmation qui dit ce qui reste | Refus si ce n'est pas sûr (§5.B) | Confirmation saisie « DELETE » + acquittement fonds |

### 5.B Supprimer un passkey

Refusé, **sans même appeler Privy**, sauf si un autre moyen d'accès est
**utilisable** : un compte Google ou Apple lié, ou un autre passkey **testé sur
cet iPhone** (« Test »). Un passkey que Privy liste n'est pas une preuve : il
peut vivre sur un autre identifiant Apple, ou avoir été supprimé de Mots de
passe. Privy seul se contenterait d'« au moins un autre compte lié », ce qui
inclut le portefeuille embarqué et laisserait retirer la dernière vraie façon de
se connecter (`utils/loginMethods.ts`, `assessPasskeyRemoval`).

Après `unlink`, ATARA **relit l'utilisateur chez Privy** et ne dit « supprimé »
que si le passkey a disparu de sa liste. Puis l'écran explique l'étape iOS :
« iOS garde sa copie ; pour la supprimer, ouvrez Réglages › Mots de passe,
trouvez-la, supprimez-la ». ATARA ne peut pas le faire et ne l'affirme pas.

### 5.C Supprimer le compte ATARA

Route authentifiée existante `DELETE /user/me`, avec `confirmation: "DELETE"`
(inchangée). Ce que fait le backend (`backend/services/user.service.ts`,
`deleteAccount`) : le profil est anonymisé (@handle libéré et remplacé par
`deleted_…`, nom « Deleted account », e-mail, photo, adresses, TOTP, code de
récupération effacés, sessions révoquées) ; les demandes de paiement non payées
et règlements non terminés du compte sont supprimés ; les messages de feedback
sont effacés ; **les dépenses, dettes et reçus partagés restent** pour les
autres membres sous « Deleted account ».

La confirmation de l'app le dit, ainsi que ce qui **ne** change **pas** :

- les fonds restent sur la blockchain, à la même adresse ;
- Privy garde les passkeys et le wallet, iOS garde ses passkeys : se reconnecter
  avec le même passkey (ou Google/Apple) permet de créer un nouveau profil pour
  **le même wallet** ;
- une case à cocher est **obligatoire** dès qu'il y a, ou qu'il pourrait y avoir,
  des fonds : un solde illisible n'est **pas** traité comme vide ;
- avertissement : supprimer les passkeys dans Mots de passe sans avoir déplacé
  les fonds les rendrait irrécupérables, y compris pour ATARA.

Localement, l'entrée reste dans la liste (« ATARA profile deleted ») avec
l'adresse du wallet, pour ne pas perdre la trace d'un wallet qui peut contenir
des fonds.

## 6. Comptes existants nommés « ATARA »

### 6.1 Identification, association, nom — ce qui est automatique

1. **Se connecter une fois** à chaque compte avec le sélecteur iOS habituel
   (rien n'a changé pour ce chemin). ATARA reconnaît le compte par son
   identifiant Privy, crée l'entrée locale, la nomme `@handle` (nom
   « automatique », qui suit le @handle tant qu'on ne l'a pas renommée) et liste
   ses passkeys d'après Privy (`origin: existant`, nom inconnu).
2. Si le compte n'a **qu'un** passkey, ce passkey est marqué « vérifié sur cet
   iPhone » (c'est celui qui vient de servir).
3. Ensuite « Switch » ne propose **que** ce passkey : plus de confusion entre
   les entrées identiques. « Passkeys & sign-in » montre, par passkey, la date de
   création, la dernière utilisation et l'appareil (données Privy) pour le
   retrouver dans iOS.

### 6.2 Renommer l'entrée dans iOS — ce qui n'est pas possible depuis l'app

Le nom d'un passkey déjà stocké par iOS ne peut pas être changé par ATARA (§2).
Le renommage local d'un compte **n'est jamais présenté** comme un renommage de la
liste iOS. Pistes évaluées :

- **A. À la main dans Réglages › Mots de passe.** Aucun risque pour ATARA.
  **[à tester]** : si iOS permet de modifier le libellé d'un passkey, c'est la
  voie la plus sûre pour les anciens comptes.
- **B. Ajouter un second passkey nommé** (Passkeys & sign-in › Add a named
  passkey). Sur un iPhone qui a déjà le premier, iOS ≥ 17.4 doit refuser (§2) ;
  sans effet destructeur. Fonctionne avec un autre gestionnaire de passkeys.
  **[à tester]**.
- **C. Remplacement** : retirer le lien de l'ancien passkey, puis recréer un
  passkey nommé (Privy n'exclurait plus l'ancien ; d'après WebAuthn, un
  authentificateur remplace le passkey découvrable de même RP et même
  identifiant utilisateur). **Non implémenté**, volontairement : il détruit
  l'ancien accès **avant** que le nouveau soit vérifié, le contraire de la
  consigne « ne supprime pas les anciennes clés avant d'avoir vérifié le nouvel
  accès », et une coupure après le remplacement dans iOS mais avant la liaison
  chez Privy laisserait un passkey inutilisable. À envisager seulement avec un
  accès de secours **lié et testé** (Google/Apple), et après essai sur appareil.

Aucun portefeuille n'est recréé, aucune ancienne clé n'est supprimée par ce
correctif.

### 6.3 Piste non retenue

Sur iOS 26, une API de mise à jour d'identifiant existerait peut-être pour
changer le libellé d'un passkey. Elle n'a pas pu être vérifiée depuis
l'environnement (documentation Apple inaccessible) et exigerait un module natif :
elle n'est ni utilisée ni promise.

---

## 7. Ce qui marche, ce qui dépend d'iOS/Privy, ce qu'il faut tester

### 7.1 Ce qui marche dans ATARA (vérifié par des tests de code)

`cd frontend && node --test scripts/*.test.cjs` — tests ajoutés ou étendus dans
`accounts.test.cjs`, `onboarding.test.cjs` et `security-flows.test.cjs`.

- Le nom donné à iOS est celui que la personne a choisi ; tout le reste de la
  requête de création (`user.id`, `rp`, `challenge`, `excludeCredentials`,
  sélection d'authentificateur) est celui de Privy.
- Un nom déjà pris, vide, trop long, « ATARA », ou différent seulement par la
  casse/les accents est refusé **avant** de créer un passkey.
- Un passkey créé mais non accepté par Privy est signalé par son nom.
- Le registre associe par identifiants Privy/ATARA ; deux comptes de même nom
  restent deux comptes (et sont départagés à l'affichage par leur @handle).
- Le renommage survit à un redémarrage (persistance réelle testée) ; une
  écriture faite avant le chargement de la liste n'écrase pas les comptes
  stockés.
- Retrait d'un compte de l'appareil : déconnexion d'abord ; si elle échoue,
  rien n'est oublié ; les paiements non terminés ne sont pas touchés.
- Suppression d'un passkey : refusée si c'est le dernier moyen ou si l'autre n'a
  pas été testé ; identifiant transmis à Privy tel que Privy l'écrit ;
  « supprimé » seulement après relecture.
- Un solde jamais lu n'est pas un solde vide.
- Le backend est inchangé : aucune route ne renvoie une liste de comptes
  d'un téléphone.

### 7.2 Ce qui dépend d'iOS et de Privy

- Le libellé de l'entrée iOS (donné à la création, non modifiable par une app) ;
  la copie du passkey (supprimable seulement dans Mots de passe) ; la
  synchronisation iCloud ; la présentation du sélecteur ; le refus d'un second
  passkey sur le même iPhone.
- Que Privy accepte la création et la liaison d'un passkey dont le nom diffère
  de celui qu'il propose (rien dans ce que le SDK poste n'en dépend, **[code]**,
  mais Privy n'a pas pu être appelé depuis l'environnement de développement).
- La demande MFA de Privy avant `unlink` si un second facteur est activé.

### 7.3 À tester sur l'iPhone (dans cet ordre)

1. **Trois comptes** : créer « Tanguy — Perso », « Tanguy — Tests », « Tanguy —
   Démo ». Réglages › Mots de passe : trois entrées aux noms **distincts**. Le
   sélecteur du Gate (« Sign in with an existing passkey ») les montre avec ces
   noms. Un nom déjà pris et « ATARA » sont refusés.
2. **Noms identiques sans confusion** : dans Manage accounts, renommer un
   compte avec le nom exact d'un autre (même en changeant la casse) : refusé.
   Chaque carte porte son @handle et son adresse abrégée, ce qui départage de
   toute façon deux comptes, même si une ancienne entrée avait le même nom.
3. **Renommer puis redémarrer** : Manage accounts › Rename, fermer l'app
   complètement, rouvrir : le nom est conservé ; l'entrée iOS **n'a pas** changé,
   et la feuille l'avait annoncé.
4. **Changer de compte** A → B → C → A : iOS n'affiche **qu'un** passkey à chaque
   fois ; le compte atteint est le bon ; soldes, contacts, surnoms et paiement en
   attente sont ceux du compte (rien de l'ancien). Annuler la feuille iOS : on
   reste sur le Gate, le bandeau « Switching to … » est encore là.
5. **Retirer de l'appareil** un compte non actif, puis le compte actif : l'entrée
   disparaît ; le passkey reste dans Mots de passe ; le sélecteur iOS le propose
   toujours ; s'y reconnecter recrée l'entrée (nom `@handle`).
6. **Supprimer le compte ATARA** : *annuler* à chaque étape → rien ne change ;
   sans « DELETE » le bouton reste inactif ; avec des fonds, la case est
   obligatoire ; confirmer → déconnecté ; se reconnecter avec le même passkey →
   nouvel écran de @handle → **mêmes fonds** à la même adresse.
7. **Passkeys & sign-in** : « Test » sur un passkey de cet iPhone (OK) ; sur un
   passkey d'un autre trousseau (message clair). « Remove » sur le seul passkey :
   refusé. Lier Google ou Apple, puis « Remove » : accepté, MFA demandée si
   activée ; le passkey disparaît de la liste ; **il est toujours dans Mots de
   passe** (l'écran l'a dit).
8. **Anciens passkeys « ATARA »** : se connecter à chacun via le sélecteur ;
   vérifier qu'un compte à un seul passkey est marqué « Checked on this
   iPhone », puis que « Switch » n'en propose qu'un. Regarder si Réglages ›
   Mots de passe permet de modifier le libellé (piste 6.2-A).
9. **Second passkey sur le même iPhone** (Add a named passkey) : noter si iOS
   refuse, et avec quel message (piste 6.2-B, §2).
10. **Autre appareil, même identifiant Apple** : le passkey nommé y apparaît avec
    son nom (synchronisation iCloud) ; la liste d'ATARA, elle, y est vide
    jusqu'à la première connexion (par conception).
11. **Aucun secret dans un rapport** : rien de ce qui précède ne doit apparaître
    dans Sentry (le nom privé n'y est jamais envoyé).
