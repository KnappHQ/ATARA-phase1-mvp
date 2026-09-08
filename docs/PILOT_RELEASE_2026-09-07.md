# ATARA — livraison pilote du 7 septembre 2026

## Objectif et périmètre

Promesse à tester : « J’avance une dépense entre amis, chacun accepte sa part et me rembourse en USDC. » Quatre onglets : Home, Activity (Transactions, Contacts, Groups), Vault, Profile. Apparence sombre et beige issue des références Lovable fournies.

USDC sur Base Sepolia reste le parcours de test par défaut. ETH est disponible pour les transferts compatibles. BTC/SOL/XMR dans la simulation illustrent un futur portefeuille multichaîne : ils ne sont pas envoyables nativement depuis un compte Base. Aucun bridge automatique livré. Une dette USDC ne change pas d’actif ou de cours pendant son règlement.

## Changements livrés dans le code

| Parcours | Comportement |
| --- | --- |
| Contacts | Suggestions @ alphabétiques ; transferts reçus/envoyés séparés des dettes acceptées. Anciennes dépenses USD conservées séparément des nouvelles dépenses USDC. |
| Groups | Répartition égale ou personnalisée avec conservation des centimes ; chaque personne accepte ou conteste sa part. Une part contestée ne déclenche aucun débit. |
| Règlement | Devis de 10 minutes fixant les parts et le montant USDC ; signature du portefeuille ; reçu vérifié sur le réseau attendu, token/payeur/destinataire/montant exacts, deux confirmations. Un reçu ne peut servir à deux règlements. |
| Reprise | Conservation locale des bundles en attente et références de règlement ; vérification après connexion ou depuis Groups. Ne pas repayer un transfert confirmé dont le rapprochement tarde. |
| Recevoir | Demande USDC valable 24 h, lien et QR EIP-681 ; page de paiement sans compte ATARA depuis un portefeuille injecté compatible. Confirmation signée par le payeur et liée à la demande et au reçu. |
| Vault | Date de blocage explicite, adhésion de tous avant dépôt, retrait après échéance et votes unanimes ; annulation collective remboursant les contributions si aucun retrait n’a eu lieu. Clôture conservant l’historique. |
| Protection Vault | `totalWithdrawn` empêche un remboursement erroné après un retrait, même après remplacement de proposition et apport externe. |
| Sécurité | Raccordement aux passkeys et TOTP réels de Privy. Téléphone optionnel désactivé. Anciennes routes de pseudo-sécurité ATARA renvoyant 410 : mise à jour du client requise. |
| Frais et données | Suppression des faux frais garantis et de la carte prétendument activée ; parrainage de gas conditionné à sa configuration ; PostHog désactivé. Sentry reste une configuration distincte. |

Le débit automatique « solde supérieur de 20 % » n’est pas activé. Le solde ne constitue pas une autorisation : une version ultérieure nécessiterait un mandat explicite, révocable, plafonné, avec échéance/réserve/réseau/token définis, puis une revue indépendante du contrat.

## Simulation

`preview/` contient la copie versionnée du site publié séparément. Parcours : groupes, dépenses, parts acceptées/contestées, remboursements fictifs et Activity, plusieurs Vaults, invitations simulées, annulation unanime et remboursement, sélection d’actifs, export CSV fictif.

Les validations au nom des contacts portent « Simuler ». Les demandes partagées dans cette simulation sont modifiables et fictives ; aucune connexion à un paiement réel. Les données de démonstration sont réinitialisées au rechargement. La simulation des passkeys, du téléphone et de la carte ne les active pas.

## Activation restante

1. **Backend de staging** : Node 22, PostgreSQL de test, variables de `backend/.env.example`. Sauvegarder puis appliquer la migration `20260906180000_pilot_payment_ledger` en staging, générer Prisma, compiler et déployer. Réseau et tokens identiques entre app et serveur. Aucune migration de production exécutée dans cette livraison.
2. **Liens publics** : configurer `PUBLIC_PAYMENT_ORIGIN`, origine HTTPS du backend servant `/api/v1/requests/pay/`. Une URI QR déjà partagée ne peut pas empêcher un transfert ERC-20 manuel après annulation/expiration : conserver le reçu et traiter ce cas explicitement.
3. **Privy** : configurer passkeys/MFA dans le projet réel et publier AASA/assetlinks pour le domaine et les identifiants natifs exacts. Tester connexion, MFA, changement/perte d’appareil. Garder `EXPO_PUBLIC_ENABLE_SMS_BACKUP=false` tant que coûts SMS et parcours complet de récupération/connexion téléphonique ne sont pas validés. Un numéro lié n’est pas une sauvegarde de clé privée.
4. **Alchemy** : configurer la politique de parrainage et ses limites ; tester gas indisponible, refus de signature, perte réseau et reprise après fermeture. La réponse réseau perdue avant réception d’un identifiant de bundle nécessite une vérification explicite dans Activity.
5. **Vault** : revoir puis déployer une nouvelle factory Sepolia et vérifier ses contrats ; renseigner les adresses et réaliser un cycle réel à plusieurs comptes de test. Les contrats existants sont immuables ; le nouveau code ne les corrige pas. L’ancienne ABI nécessite une lecture compatible ou une migration de configuration.
6. **Mobile** : produire et distribuer de nouveaux builds iOS/Android. Publier la simulation ne publie pas le backend, les builds ni les contrats.
7. **Fonds réels** : passage après validation de staging, revue indépendante des paiements/récupération, périmètre commercial et budgets approuvés. `ENABLE_MAINNET_PAYMENT_REQUESTS=false` par défaut.

Transactions PostgreSQL sérialisables pour les parts, les devis et l’usage des reçus ; une contention peut nécessiter une nouvelle tentative. La clé d’idempotence empêche de doubler une dépense. La migration et les scénarios concurrents n’ont pas été exécutés sur une base de staging ici.

## Vérification

Compilation TypeScript backend et frontend ; 10 tests backend (authentification, MoonPay, montants et parts, rejets de faux tokens/payeur/destinataire/reçus ambigus, signature EOA) ; 14 tests Solidity (consentement, délais, plafonds, rejouabilité, transferts échoués, réentrance, remboursements, régression retrait/proposition/apport externe). Test du registre de démonstration et test DOM : @ contacts, navigation, acceptation, remboursement, Activity, plusieurs Vaults, consentement au dépôt, absence de double remboursement.

Commandes : `npm run build && npm test` dans backend ; `npm run typecheck` et `npm run lint` dans frontend ; `npm test` et `npm run abi:check` dans contracts ; `node tests/preview-dom.cjs` et `node --test tests/preview-ledger.test.cjs` à la racine après installation backend. Utiliser Node 22 et `npm ci` ; Prisma exige une URL PostgreSQL de configuration. Les tests locaux ne sont ni un audit, ni un essai sur téléphone physique, ni une intégration partenaire de production.

## Adoption : pilote proposé, sans budget engagé

Objectif : 20 groupes de 3 à 8 amis partageant régulièrement des dépenses ; ce n’est pas une traction existante. Démarrer avec 5 groupes observés, corriger les abandons, puis élargir.

Séance de 15 minutes : créer un groupe → répartir une dépense → accepter/contester → rembourser en test → retrouver le reçu ; tester aussi mauvaise connexion et annulation de Vault. Obtenir l’accord des participants avant toute étude nominative.

Mesurer manuellement avec des identifiants pseudonymes : activation, parts acceptées, délai de règlement, retours en deuxième semaine, demandes d’aide et incidents. Critères de décision proposés : 4 groupes sur 5 terminent sans assistance, aucun écart de solde ni double reçu, puis au moins la moitié revient la semaine suivante. Ce sont des hypothèses de pilotage, pas des prévisions.

Les liens de remboursement et invitations servent au partage utile. Aucune campagne de messages aux testeurs, import de carnet d’adresses, récompense financière ou publicité payante déclenchée. Recrutement à organiser avec Tanguy.

## Partenaires

Voir [la demande Gnosis Pay prête à envoyer](GNOSIS_PARTNER_REQUEST.md). Prix sur devis et engagements Startup publiés à partir de deux ans : aucun faible coût acquis. Obtenir une dérogation pilote et chiffrer les minima avant l’intégration carte.

MoonPay reste en sandbox sans clés/validation commerciale. Carte et on-ramp dépendent des vérifications du prestataire ; aucune promesse d’absence de KYC. Aucune carte émise, contrat commercial accepté ou dépense engagée.
