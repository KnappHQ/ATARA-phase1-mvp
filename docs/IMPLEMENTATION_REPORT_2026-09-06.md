# Compte rendu d’implémentation ATARA

> Rapport historique. Le [compte rendu du 7 septembre](PILOT_RELEASE_2026-09-07.md) précise les limites : BTC/SOL/XMR sont des actifs de démonstration, la carte n’est pas activée et les déploiements natifs restent distincts.

Date : 6 septembre 2026  
Branche GitHub : `codex/atara-vault`

## Résumé

La bêta ATARA dispose maintenant d’un parcours Vault complet dans l’interface
et dans le contrat Solidity de référence : création, invitations, acceptation
des règles, dépôts, retrait soumis à l’accord de tous et suppression collective
avec remboursement des contributions.

## Fonctionnalités ajoutées

### Portefeuille et paiements

- Solde principal navigable entre USDC, ETH, BTC, SOL et XMR par swipe gauche/droite.
- Sélection de la crypto utilisée pour un envoi ou un paiement marchand.
- Solde disponible et symbole mis à jour selon l’actif sélectionné.
- Suggestions de contacts quand l’utilisateur tape `@`, triées par ordre alphabétique.
- Recherche élargie aux contacts récents, favoris et carnet d’adresses connus.

### Vault

- Création d’un Vault avec nom public et durée de blocage.
- Invitations de membres par handle ATARA ou smart account.
- Liste des membres avec état d’acceptation et contribution individuelle.
- Affichage explicite : **« Fonds bloqués jusqu’au [date] »**.
- Après la date : retrait toujours soumis à une validation unanime.
- Suppression collective avec une confirmation par membre.
- `cancelVault` rembourse exactement `contributions[membre]` à chaque déposant.
- Aucun compte administrateur ne peut déplacer les fonds unilatéralement.
- Si un retrait a déjà été exécuté, le remboursement exact est bloqué : les
  contributions historiques ne correspondent plus au solde restant.

## Contrat et sécurité

Le contrat `AtaraGroupVault` contient désormais :

- `setCancellationApproval(bool)` pour les confirmations de suppression ;
- `cancelVault()` pour exécuter un remboursement unanime ;
- les compteurs et états de suppression dans `snapshot()` ;
- les événements `CancellationApprovalChanged` et `VaultCancelled` ;
- une protection empêchant un remboursement incorrect après un retrait exécuté.

Les membres d’un Vault sont fixés dans les termes publics au moment de la
création. Un Vault déjà déployé ne peut donc pas ajouter silencieusement une
nouvelle adresse ; l’invitation est acceptée explicitement par chaque membre.

## Simulation publiée

La simulation interactive permet de tester :

1. `Vault` → `+ Créer un Vault` ;
2. saisie de `@` et sélection d’un contact ;
3. dépôt fictif ;
4. `Demander la suppression` ;
5. confirmations des membres simulés ;
6. remboursement de chaque part et solde du Vault remis à zéro.

Lien : https://atara-simulation.tanguygoursaud.chatgpt.site

La simulation n’envoie aucun actif et ne signe aucune transaction.

## Vérifications effectuées

- 13 tests de contrats Solidity passent, dont le remboursement exact et le
  refus d’un remboursement après retrait exécuté.
- Typecheck frontend : OK.
- Lint frontend : 0 erreur ; un avertissement existant dans
  `frontend/app/security.tsx` (`RefreshCw` non utilisé).
- Build backend : OK.
- Vérification de cohérence des ABI : OK.
- Vérification JavaScript et espaces Git : OK.

## Reste à faire avant l’activation on-chain

Le code et les ABI sont poussés sur GitHub, mais la nouvelle version du contrat
n’est pas encore déployée sur Base Sepolia. Avant d’activer ces fonctions avec
de vrais tokens de test, il faut :

1. redéployer `AtaraVaultFactory` et `AtaraGroupVault` ;
2. vérifier les contrats sur BaseScan ;
3. renseigner l’adresse de la nouvelle factory dans
   `EXPO_PUBLIC_VAULT_FACTORY_ADDRESS` et `VAULT_FACTORY_ADDRESS` ;
4. refaire un test de création, dépôt, annulation et remboursement sur Sepolia.

Les anciens Vaults déployés restent immuables et ne reçoivent pas ces nouvelles
fonctions automatiquement.
