# ATARA Vault — plan beta livré

Le Vault est une cagnotte collective USDC sur Base Sepolia. Il reprend l’idée
d’une tontine pour l’épargne de groupe, sans imposer une rotation automatique :
le groupe choisit ensemble le bénéficiaire et le montant de chaque retrait.

## Règles visibles dans l’app

Chaque Vault a un nom public, 2 à 10 membres, une date de déblocage unique et
un plafond de 10 000 USDC de test. Tous les membres doivent accepter les règles
avant le premier dépôt. Les dépôts sont fermés à la date de déblocage.

La création propose une invitation par handle ATARA (ou par smart account). Les
adresses sont fixées dans les termes publics du Vault au moment de sa création;
chaque invité doit ensuite accepter les règles depuis son propre compte. Un
Vault déjà déployé ne peut pas ajouter une adresse en silence.

Les écrans affichent toujours :

> **Fonds bloqués jusqu’au {date}**

Après cette date, l’écran affiche :

> **Date atteinte — accord unanime encore requis**

La date ne déclenche aucun transfert. Un membre propose l’adresse exacte et le
montant exact, puis chaque membre valide ce même retrait. Une validation peut
être retirée avant l’exécution. La proposition expire après sept jours et une
nouvelle proposition recommence avec zéro validation. Un membre peut exécuter un
retrait uniquement quand tout le monde a validé.

Cette règle stricte est adaptée à une bêta parce qu’elle est compréhensible et
ne donne aucun pouvoir de retrait à ATARA. Elle comporte un risque assumé : un
groupe peut rester bloqué si un membre perd son accès ou refuse de voter. Aucun
compte administrateur ou mécanisme de récupération ne contourne cette règle.

## Suppression et remboursement collectif

Avant ou après la date de déblocage, chaque membre peut confirmer la suppression
du Vault. Un membre peut retirer sa confirmation tant que la suppression n’est
pas exécutée. Lorsque tout le monde a confirmé, n’importe quel membre peut
exécuter `cancelVault` : le contrat rembourse exactement
`contributions[membre]` à chaque adresse, remet le solde comptable à zéro et
marque définitivement le Vault comme supprimé. Une proposition de retrait
active doit d’abord être expirée ou annulée. Si un retrait a déjà été exécuté,
la suppression avec remboursement exact n’est plus disponible, car les
contributions historiques ne décrivent plus le solde restant. Il n’existe pas
de bouton admin ou de remboursement unilatéral.

## Contrats livrés

`AtaraVaultFactory` crée un Vault isolé par groupe et indexe les adresses par
membre. Le contrat vérifie Base Sepolia, l’USDC à six décimales, les membres
uniques et la limite de pagination. Une nouvelle tentative avec les mêmes
termes renvoie le même Vault ; elle ne peut pas remplacer ses règles.

`AtaraGroupVault` garde les fonds, les acceptations, les contributions et les
votes. Les transferts utilisent `SafeERC20`, sont protégés contre la
réentrance, refusent les tokens à frais et ne permettent ni appel arbitraire,
ni retrait propriétaire, ni upgrade. Chaque dépôt porte un identifiant unique
pour qu’une reprise après perte de réseau ne crée pas un second dépôt.

Les tests couvrent les termes invalides, les acceptations incomplètes, les
plafonds, la frontière temporelle, les votes partiels, l’expiration, les smart
accounts, les tokens malveillants, la réentrance, la conservation des fonds et
les retries idempotents.

## Paiement et ajout de crypto

L’app reste sur Base Sepolia pendant la bêta. Le bouton **Ajouter des crypto**
ouvre MoonPay avec l’adresse smart account déjà renseignée. L’URL contenant
cette adresse est signée dans le backend ; la clé secrète MoonPay ne quitte
jamais le serveur. Le fournisseur peut demander une vérification d’identité et
le montant final dépend de son devis et de ses frais.

Le bouton **Payer une course** envoie de l’USDC vers l’adresse du commerçant et
enregistre la transaction dans l’activité ATARA. En bêta, le commerçant doit
accepter USDC sur Base Sepolia et fournir une adresse de paiement. Le paiement
est irréversible après confirmation ; le réseau et l’adresse sont rappelés
avant la signature. Un scanner QR pourra être ajouté lorsque le format de reçu
commerçant sera arrêté, afin de ne pas afficher un scanner qui ne ferait rien.

## Déploiement et activation

Les contrats ne sont pas présentés comme déployés tant qu’une adresse n’est pas
configurée. Après revue, déployer avec `contracts/.env` sur Base Sepolia, puis
placer l’adresse de la factory dans :

- `EXPO_PUBLIC_VAULT_FACTORY_ADDRESS` côté frontend ;
- `VAULT_FACTORY_ADDRESS` côté backend.

Le backend vérifie que son RPC est bien sur le chain ID 84532. Les clés MoonPay
(`MOONPAY_API_KEY` et `MOONPAY_SECRET_KEY`) sont obligatoires pour activer
l’achat ; sans elles, l’app affiche que l’on-ramp est en préparation.

## Contrats à envisager plus tard

Après la bêta et une revue externe :

1. un module de récupération du smart account, sans réduire le seuil de vote ;
2. un routeur de paiement marchand ou un QR signé avec expiration ;
3. un escrow de commande avec fenêtre de remboursement ;
4. des limites de dépense par token pour le smart account ;
5. un routeur de paiements groupés ;
6. un contrat d’épargne individuelle verrouillée ;
7. une intégration de rendement uniquement avec un protocole externe audité.

Les signatures off-chain EIP-712/ERC-1271, le rendement et les invitations
ajoutées après déploiement ne font pas partie de la première bêta : ils
augmenteraient les risques de récupération et de mauvaise compréhension des
règles. La suppression collective et le remboursement des contributions sont
désormais inclus dans le contrat bêta, avec un vote unanime explicite.
