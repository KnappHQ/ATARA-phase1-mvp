# Vérification des paiements — « Verification unavailable », doublons, Activity

Étude et correctif du 30 septembre 2026, sur `release/store-beta`
(branche `claude/manage-accounts-passkeys`, même intervention que
[ACCOUNTS_AND_PASSKEYS.md](ACCOUNTS_AND_PASSKEYS.md)).

Symptôme : dans Activity, « Payment awaiting verification » puis, en touchant
**Check wallet operation** : « Verification unavailable — The wallet status
could not be checked. Do not send another payment yet. » Le paiement reste
bloqué, on ne sait pas s'il a eu lieu, et les lignes de l'historique
superposent @handle, adresse et montant.

Légende, comme dans le document sur les comptes : **[code]** lu dans le code du
dépôt ou de `node_modules` ; **[déduit]** conclusion logique, non observée ;
**[à tester]** ne peut être confirmé que sur un iPhone avec le vrai réseau.

---

## 1. Cause : ce qui est établi, et ce qui ne l'est pas

**Non observé.** Le conteneur où ce travail est fait n'a accès ni à Alchemy, ni
à Privy, ni à l'API ATARA, ni aux nœuds Base (politique de sortie). La réponse
exacte que le fournisseur a donnée à l'iPhone de la capture n'a donc **jamais
été lue**. Aucune des explications ci-dessous n'est présentée comme « la »
cause observée.

**Établi dans le code (état avant ce correctif) :**

1. L'ancien contrôle passait par le client **de signature** du wallet
   (`SmartAccountService.checkPendingOperation`). Sans wallet initialisé, ou
   pour un compte qui n'est pas celui connecté, il n'y avait rien à interroger.
   **[code]**
2. Toute erreur du fournisseur était traitée de la même façon : « unavailable ».
   Un délai dépassé, une coupure réseau, une clé refusée, une limite de débit et
   « ce fournisseur ne connaît plus cet identifiant » (erreur 5730) produisaient
   le même message, et on ne gardait **rien** qui dise laquelle. **[code]**
3. Dans le code d'avant ce correctif, l'alerte « Verification unavailable »
   n'était atteinte que par une **exception** sortant du contrôle : une erreur
   du fournisseur, elle, était rattrapée à l'intérieur et donnait « unavailable »
   puis « Still checking » ou la proposition de libérer. Les exceptions
   possibles étaient l'erreur de verrou « une opération est déjà en cours pour
   ce wallet » (un envoi ou un autre contrôle en cours) et une erreur de
   lecture du stockage ; toutes deux étaient affichées comme un problème de
   vérification. **[code]** Le texte de la capture (« Do not send another
   payment yet ») n'est plus celui du code actuel : la capture vient d'un build
   plus ancien. **[déduit]**
4. Le seul identifiant conservé était l'id d'appel du fournisseur. Dès que le
   fournisseur l'oubliait, il n'existait plus aucun moyen de savoir si le
   paiement était passé, alors que la chaîne, elle, le sait. **[code]**
5. L'enregistrement n'était écrit **qu'après** le retour de `sendCalls`. Une
   application fermée, ou une connexion perdue, entre « envoyé » et « réponse
   reçue » laissait un paiement peut-être en route **sans aucune trace**. **[code]**
6. Le hash d'un transfert confirmé n'était gardé qu'en mémoire (`useTransactionStore`).
   Si l'app se fermait avant l'enregistrement par le service ATARA, le paiement
   n'apparaissait plus jamais dans l'historique. **[code]**

**Déduit, non observé :** le message de la capture vient d'une version
antérieure à #64 et correspond à l'un de ces cas. Le correctif ne dépend pas de
savoir lequel : chaque cas est maintenant **distingué, conservé et affiché** sur
l'appareil (section 4), et c'est cet affichage qui donnera la cause réelle la
prochaine fois. **[à tester]**

---

## 2. Trois identifiants qui ne sont pas interchangeables

Lus dans les exemples du SDK (`@alchemy/wallet-api-types` `src/rpc/examples.ts`,
`@alchemy/wallet-apis` 5.0.6). **[code]**

| Nom | Ce que c'est | Où il vit | À quoi il sert |
|---|---|---|---|
| **Identifiant d'appel** (« bundle id ») | Retourné par `sendCalls`, pris par `getCallsStatus`. Deux mots de 32 octets : *chain id* puis *hash de l'opération*. | Chez Alchemy seulement | Demander au fournisseur où en est le paiement |
| **Hash de l'opération** (`userOpHash`) | Hash ERC-4337. Déjà connu **avant** l'envoi (`details.data.hash` de `prepareCalls`) et contenu dans l'identifiant d'appel. | Sur la chaîne : champ indexé de `UserOperationEvent` de l'EntryPoint | Demander à la **chaîne** si l'opération a tourné, sans le fournisseur |
| **Hash de transaction** | Transaction qui a porté l'opération. N'existe qu'une fois incluse. | Sur la chaîne | Ce dont le service ATARA a besoin pour enregistrer le paiement |

Un test lance le vrai SDK contre un transport scripté et exige que le hash lu
avant l'envoi soit celui de l'identifiant d'appel renvoyé
(`scripts/payment-sdk-parity.test.cjs`). L'identifiant d'appel reste opaque
pour tout ce que l'app fait d'autre : il n'est décomposé que s'il a exactement
la forme documentée, et sert alors à interroger la chaîne, jamais à décider
qu'un paiement a réussi.

---

## 3. Règles

1. **Un paiement n'est « échoué » que sur une réponse explicite** : statut
   fournisseur 400, 500, 600 ou 410, ou opération vue sur la chaîne avec
   `success = false`. Un délai dépassé, une coupure, « id inconnu », une limite
   de débit, « rien trouvé dans les blocs cherchés » ne le sont **jamais** : le
   paiement reste « non résolu » et **bloque le suivant**.
2. **L'intention est écrite avant l'envoi.** `prepareCalls` (rien n'est engagé)
   → écriture de l'enregistrement avec le hash de l'opération → signature →
   `sendPreparedCalls`. Un test contrôle que l'enregistrement existe *dans* la
   requête d'envoi. Les trois requêtes sont identiques à celles de `sendCalls`
   du SDK (test de parité).
3. **Refus explicite ≠ incertitude.** Si le fournisseur répond par un refus
   (code JSON-RPC, HTTP 4xx), rien n'est parti : l'enregistrement est retiré
   (la relance avec gaz reste possible). Sur délai, coupure ou 5xx, la requête
   a peut-être été acceptée : l'enregistrement reste, la chaîne tranchera.
4. **Réconciliation à deux sources**, sans wallet initialisé : le fournisseur
   (`wallet_getCallsStatus`, client en lecture seule sans signataire), puis la
   chaîne (`getLogs` sur les EntryPoint v0.6/0.7/0.8, filtre sur le hash de
   l'opération, fenêtres adaptatives, départ proche de l'heure du paiement).
   Le transfert est vérifié **dans** l'opération (bornes entre événements
   `UserOperationEvent`) : deux paiements identiques d'un même compte dans un
   même bundle restent deux transferts.
5. **Confirmé mais pas enregistré : on ne réessaie que l'enregistrement.**
   Le transfert confirmé est mis dans une **boîte d'envoi** persistante
   (`atara.recording.<réseau>.<compte>.<txHash>`) **avant** que
   l'enregistrement « en attente » soit retiré. `/transaction/sync` est
   idempotent par hash : on peut le rappeler sans risque. Reprise avec
   attente croissante (15 s → 15 min), à l'ouverture d'Activity, au retour au
   premier plan et à la connexion. Il n'existe **aucun chemin** de la boîte
   d'envoi vers un envoi d'argent.
6. **Un paiement introuvable peut être « libéré »** par le propriétaire,
   seulement après 30 min (2 h si le fournisseur dit encore « en cours »),
   avec l'avertissement du risque de doublon. Il n'est pas supprimé : il passe
   sur une **liste de surveillance** (14 jours) et, s'il finit par passer,
   Activity le dit.
7. **Ne pas fusionner deux paiements parce qu'ils se ressemblent.** Deux
   entrées ne sont « le même paiement » que par le même hash de transaction ou
   le même id d'enregistrement du service. Jamais par montant + destinataire.
   Le contrôle « même paiement depuis un autre compte » ne sert qu'à
   **refuser** un envoi, jamais à en déclarer un doublon.

`backend/` n'est **pas modifié**. Le comportement « fail-closed » du service
(202 / 404 / 409 / 5xx tant que le transfert n'est pas vérifié et confirmé
≥ 2 fois) est inchangé : ce correctif l'utilise tel quel.

---

## 4. Ce que l'écran dit

Activity affiche une carte par paiement non réglé, avec des phrases fixes
(aucun message brut, aucune URL, aucune adresse dans les traces) :

| État | Titre | Ce qu'il dit |
|---|---|---|
| en cours | Payment still processing | Le fournisseur l'a et le traite ; rien n'a été renvoyé |
| introuvable | This payment can't be found yet | Ni le fournisseur ni la chaîne ne le montrent ; **ça ne veut pas dire qu'il a échoué** ; ne le renvoie pas |
| injoignable | This payment could not be verified yet | Pas de réponse claire (connexion / service) ; ça ne dit rien de ton paiement |
| confirmé | Payment confirmed | Il est passé ; il sera dans l'historique dès qu'ATARA l'a enregistré |
| échoué | Payment did not go through | Le réseau dit explicitement que non ; aucun argent n'a bougé ; tu peux le renvoyer |
| passé, pas enregistré | Payment made, being added to your history | L'argent est parti ; seul l'enregistrement est réessayé ; « Record it now » |
| autre réseau / autre compte | A saved payment is for another … | Non utilisé, non modifié |

« Show details » montre, **entiers et copiables**, le hash de transaction, le
hash d'opération et l'identifiant d'appel, et le journal de ce qui a été
vérifié (« Wallet service : … », « Base network : … (blocks a–b) »).

---

## 5. Lien avec la gestion des comptes

- Chaque enregistrement est sous `atara.pending-call-bundle.<réseau>.<adresse
  du smart account>` : **un compte, un réseau**. À la lecture, une seconde
  vérification refuse un enregistrement dont le réseau ou le compte ne
  correspond pas (jamais utilisé, **jamais effacé**).
- Changer de compte n'efface ni ne mélange rien : chaque compte retrouve son
  paiement à la reconnexion. Un compte connecté ne voit que ses cartes.
- **Interdit de renvoyer un paiement incertain** : tant qu'il est non résolu,
  aucun autre paiement ne part de ce compte, et **le même paiement** (même
  actif, même destinataire, même montant) est refusé depuis **un autre compte
  du même iPhone**, avec le nom du problème.
- **Manage accounts** : une ligne « A payment is waiting to be verified » (ou
  « … made, not yet in history ») sur le compte concerné. Changer de compte,
  le retirer de l'iPhone ou supprimer le compte ATARA affichent l'avertissement
  correspondant ; le retrait demande « Remove anyway ». Supprimer le compte
  ATARA ajoute une reconnaissance écrite si un paiement n'est pas réglé.
  **Aucune de ces actions n'efface l'enregistrement.**
- Les anciens enregistrements (identifiant nu, `{id, fingerprint}`,
  `{id, fingerprint, createdAt}`) sont lus tels quels : un paiement bloqué
  aujourd'hui sur l'iPhone est retrouvé **sans désinstaller ni effacer les
  données**. Un enregistrement sans date peut être libéré.

---

## 6. Affichage Activity

Avant : nom, adresse et montant sur une seule ligne, l'adresse recevant un
`flexShrink: 100` pour « laisser la place ». Après (`RowHeader`,
`utils/rowLayout.ts`) :

```
[ nom / @handle (…)        ]  [ montant ]     la zone d'identité rétrécit, jamais le montant
[ 0x5999…204c              ]                  l'adresse a sa propre ligne, coupée au milieu
[ note (…)                 ]  [ date ]
```

- Le montant est à droite (max 45 %), réduit sa police avant de passer à la
  ligne (`adjustsFontSizeToFit`), et ne chevauche rien.
- **Le montant passe sous le nom** dès que le texte est agrandi
  (`fontScale ≥ 1,25`) ou que l'écran fait moins de 350 pt.
- Toute la croissance du texte est plafonnée (×1,6) pour qu'une ligne ne
  remplisse pas l'écran. Les écrans de détail (contact, transaction) coupent
  les noms longs et réduisent le montant.

Doublons : l'historique vient du service ATARA, dédoublonné par id
d'enregistrement ; un paiement en attente d'enregistrement n'est **jamais**
mélangé aux lignes de l'historique (il a sa carte) et sa carte disparaît dès
que son hash apparaît dans l'historique.

---

## 7. Ce qui a été testé, ce qui ne l'a pas été

**Testé sans téléphone** (`node --test scripts/*.test.cjs`) :

- reprise après fermeture de l'app (nouvelle instance sur le même stockage) ;
- réseau coupé puis revenu ; vérifications répétées ; bornage du journal ;
- confirmation par la chaîne alors que le service ATARA est indisponible, puis
  enregistrement plus tard, avec **un seul envoi** d'argent sur toute
  l'histoire ;
- changement de compte, même paiement depuis deux comptes, paiements
  différents autorisés ;
- anciens formats persistés ; enregistrement d'un autre réseau / compte ;
- verrou pris → « busy » et non « échec » ;
- refus explicite vs délai, signature refusée, erreur de préparation ;
- le vrai SDK (`@alchemy/wallet-apis`) et un vrai client viem contre des
  transports scripté : mêmes requêtes que `sendCalls`, `wallet_getCallsStatus`
  et `eth_getLogs` bien formés, erreur 5730 reconnue ;
- rendu des lignes (zones, agrandissement, écran étroit), avertissements des
  écrans de comptes, textes des cartes (un état incertain ne dit jamais
  « échoué »).

**Non testé — à faire sur l'iPhone :**

1. Ouvrir Activity avec le paiement bloqué actuel : la carte s'affiche, « Check
   now » donne une des phrases de la section 4 avec, dans « Show details »,
   **ce que le fournisseur et la chaîne ont répondu**. Noter la phrase.
2. Comparer l'état affiché avec le transfert réel sur Basescan (hash copiable) :
   confirmé ⇒ le transfert existe, montant et destinataire identiques.
3. Envoyer un petit paiement, fermer l'app pendant l'attente, rouvrir : la carte
   « awaiting verification » revient et se règle.
4. Mode avion pendant l'attente, puis retour du réseau.
5. Deux comptes : le paiement de l'un ne bloque pas l'autre, sauf le même
   paiement ; les avertissements de Manage accounts.
6. Petit iPhone + « Larger Text » + un nom très long : aucune superposition.

**Limites connues.** La recherche sur la chaîne ne remonte que ~46 jours au
plus et dépend d'un nœud qui accepte `getLogs` (Alchemy d'abord, nœud public
Base ensuite). Un paiement introuvable après ce délai reste « non résolu » ;
seul le propriétaire peut le libérer, en connaissance du risque.

---

## 8. Déploiement

- **Render : rien à faire.** Aucun fichier de `backend/` n'est modifié.
- **TestFlight** : fusionner la PR dans `release/store-beta` déclenche « Store
  Beta » (lint, typecheck, `bundle:native`, tests, puis build). La PR n'est pas
  fusionnée tant que le parcours ci-dessus n'a pas été essayé, parce que la
  fusion produit un build partant sur TestFlight.
