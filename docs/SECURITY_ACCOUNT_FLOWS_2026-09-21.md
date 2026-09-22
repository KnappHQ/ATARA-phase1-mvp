# ATARA — correctifs sécurité et changement de compte

État du 21 septembre 2026. Branche locale `fix/security-account-flows`, basée sur
`origin/release/store-beta` au commit `92b1aa3`. Aucun push, déploiement ou build
TestFlight effectué pour ces modifications. Les exports Expo sont des bundles JS,
pas une application iOS signée ni un test physique.

## Diagnostic et changements

| Symptôme | Constat dans le code | Correction locale |
| --- | --- | --- |
| Weekly Flow toujours visible | Suppression présente sur main mais pas dans la branche de bêta examinée | Retrait du composant de l’accueil dans `frontend/app/(tabs)/index.tsx` |
| « Already logged in » après révocation | La révocation ATARA ne fermait pas systématiquement Privy | Nettoyage coordonné des sessions ATARA/Privy/Reown ; nouveau login bloqué si le nettoyage fournisseur échoue |
| Déconnexion introuvable | Petite icône sans libellé visible | Deux entrées explicites dans Profil : déconnexion et utilisation d’un autre compte ; confirmation distincte de la suppression |
| Second facteur : plein écran bloquant | Parcours UI fournisseur sans délai maximal | Parcours TOTP intégré dans Sécurité, indicateur compact, attente limitée à 20 s, annulation locale, saisie de six chiffres et confirmation serveur |
| Wallet externe inopérant | L’ouverture de la fenêtre Reown était traitée comme une connexion terminée | Attendre connexion ET provider ; annulation/expiration ; contrôle du réseau effectif ; signature `personal_sign` avec message encodé en hexadécimal |
| Risque de données d’un autre compte | Contacts/groupes/historique pouvaient survivre à la déconnexion ou être repeuplés par une réponse tardive | Réinitialisation commune et invalidation des réponses de l’ancien compte ; écritures SecureStore sérialisées |
| Ajout de passkey : webcredentials | Erreur d’association iOS, distincte d’une erreur de signup | Diagnostic de l’identifiant Apple exact, bon parcours d’association au compte connecté, routes publiques d’association hors quota API |

Le changement de compte termine la session courante puis permet une nouvelle
connexion. Ce correctif ne crée pas un gestionnaire de plusieurs comptes ouverts
simultanément et ne supprime ni le compte ni ses fonds.

Le timeout ou le bouton Annuler met fin à l’attente dans l’interface, mais ne peut
pas annuler une requête déjà reçue par Privy. Le verrou conserve l’exclusion tant
que cette requête n’est pas terminée. Une activation MFA ne doit être annoncée
qu’après confirmation du fournisseur ; le secret TOTP reste en mémoire dans
l’écran et est effacé à la fermeture/annulation/changement de compte.

## Passkeys : limite du diagnostic

**Nouvelle preuve du 21 septembre 2026 à 08:47 UTC :** le CDN Apple renvoie
HTTP 404 avec `apple-failure-reason: SWCERR00301 Timeout`,
`apple-failure-details: {"cause":"Connection timed out"}` et
`apple-from: https://api.atara.finance/.well-known/apple-app-site-association`.
Un premier appel direct a aussi expiré, puis un second a répondu HTTP 200 avec
le bon identifiant. L’échec Apple est mis en cache (`max-age=3600`).
Cela établit un défaut de disponibilité observé par Apple, pas seulement une
erreur de formulaire dans l’application. Un démarrage à froid est une hypothèse,
pas une cause confirmée sans logs et type d’instance Render.

Après confirmation utilisateur du workspace « My Workspace », lecture de Render :

- Service `atara-api` (`srv-dafi3qht0dsc73e856vg`), Francfort, instance **free**.
  Le champ `buildPlan: starter` concerne le build ; le compute en ligne reste
  `serviceDetails.plan: free`.
- Branche configurée : `codex/atara-vault`. Déploiement effectif :
  `dep-dakl6sgu01pc73fhf3sg`, commit `0d97947b52f377fa887a627b6b0d7b8c58a1ad1a`,
  publié le 15 septembre. Ne pas confondre la tête Git actuelle et le commit live.
- Nouveau démarrage à 08:46:45 UTC le 21 septembre ; le start exécute
  `prisma migrate deploy && node dist/server.js`, migrations terminées à
  08:46:57, chargement de l’application à 08:46:58. Apple enregistre le timeout
  à 08:47:03. D’autres démarrages sont visibles le 20 septembre à 17:05, 17:44
  et 19:01. Cette concordance et le plan gratuit étayent fortement l’hypothèse
  du réveil de l’instance ; les logs ne nomment pas explicitement la cause de
  chaque redémarrage.
- Le health check HTTP configuré sur le service est vide, malgré la valeur dans
  `render.yaml` : le fichier du dépôt n’est pas la preuve de la configuration live.
- Différence backend entre le commit live et `92b1aa3` : le délai maximal de
  vérification Alchemy dans `backend/services/smartAccountOwnership.service.ts`
  et son test ne sont pas déployés. Le retrait du quota sur AASA est une autre
  modification locale, également non déployée.

Aucun service, tarif ou paramètre distant n’a été changé. La documentation
[Render Free](https://render.com/docs/free) confirme la mise en veille après
15 minutes sans trafic et un réveil d’environ une minute.

Deux corrections d’infrastructure possibles, à autoriser séparément :

1. Instance API toujours active (plan payant, prix à confirmer avant souscription) :
   solution simple pour supprimer la veille sur AASA **et** les appels API.
2. Servir le document AASA de façon statique au même chemin sur
   `api.atara.finance`, devant Render : évite que la confiance Apple dépende du
   réveil du backend. Nécessite accès au routage/DNS ; ne pas déplacer le RP ni
   remplacer toute l’API par un site statique. L’API gratuite garderait ses
   lenteurs de réveil pour les autres opérations. Aucune infrastructure edge
   n’est créée ou prête à déployer à ce stade.

La validation des passkeys reste **bloquée** : corriger la disponibilité de ce
document sur le même domaine, puis vérifier la disparition de l’erreur CDN avant
la recette physique. Le seul retrait du quota API ne corrige pas une instance
indisponible ; aucune garantie de résolution complète n’est donnée ici.

Les contrôles en lecture seule du 20 septembre ont obtenu HTTP 200 et
`webcredentials.apps = ["8UTUKDR95M.com.atara.app"]` depuis l’API et le CDN Apple.
Le serveur présentait des en-têtes de quota API sur ce document public : le
correctif backend supprime cette dépendance au quota des utilisateurs. Cela
n’établit pas qu’un quota dépassé était la cause de la capture fournie.

`frontend/app.config.js` et le profil beta définissent déjà
`webcredentials:api.atara.finance`. Il reste nécessaire de vérifier ces droits
dans l’application **signée installée**, ainsi que le comportement du cache iOS.
Une réponse HTTP correcte aujourd’hui ne prouve pas que l’iPhone a pu établir
l’association lors de l’installation. Aucun changement arbitraire du domaine RP
n’est proposé : il pourrait rendre les anciennes passkeys inutilisables.

Le catalogue Reown répondait également HTTP 200 au contrôle public ; cela ne
valide ni le relais WalletConnect, ni l’ouverture d’un wallet installé, ni le
retour dans ATARA. Le crash natif n’a pas été reproduit sur un iPhone ici.

## Vérifications exécutées

- Frontend : `node --test scripts/*.test.cjs` : **44 tests réussis**.
- `npm run typecheck`, `npm run lint` et `git diff --check` : réussis.
- Backend : compilation réussie ; **49 tests réussis, 1 ignoré**. Le test de
  suppression utilisant une vraie base nécessite `TEST_DATABASE_URL` et n’a pas
  été exécuté. Aucune base de production utilisée.
- Exports Expo iOS et Android du profil beta : réalisés sans build cloud.
- Tests de régression : ancien login après déconnexion, double clic, échec du
  logout fournisseur, connexion externe sans provider prêt, annulation, timeout,
  activation MFA, mauvaise association Apple, révocation échouée, retour de
  session au redémarrage et réponse profil tardive après changement de compte.

Les tests simulent les frontières SDK et stockage natif. Ils ne constituent pas
un test de bout en bout avec les serveurs Privy, un authentificateur ou un wallet
réel. Les tests de présence de boutons ne mesurent pas leur rendu sur téléphone.

## Recette iPhone avant diffusion

1. Vérifier que l’IPA signé contient `application-identifier =
   8UTUKDR95M.com.atara.app` et le droit `webcredentials:api.atara.finance`.
   Déployer le correctif d’association backend avant de qualifier la passkey.
2. Sur un compte de test existant : Profil → Sécurité → Ajouter une passkey.
   Confirmer dans iOS, vérifier le compteur, se déconnecter et se reconnecter
   avec cette passkey. Ne pas supprimer l’app ou les moyens de récupération
   d’un compte contenant des fonds pour ce test.
3. Sur un nouveau compte de test : créer avec passkey, terminer le profil,
   vérifier que la création n’est pas confondue avec l’association à l’ancien
   compte. Tester aussi l’annulation de la fenêtre iOS.
4. MFA : initialiser, ouvrir un authentificateur ou saisir la clé manuellement,
   tester un code incorrect puis correct. Tester absence réseau, réponse lente,
   annulation et retour. Vérifier dans Privy que le facteur est réellement
   associé ; vérifier une demande de signature protégée, avec des fonds de test.
5. Wallet externe : wallet installé puis absent ; choisir le wallet, accepter
   puis refuser la connexion/signature, revenir par lien profond, changer de
   réseau. Vérifier la preuve de propriété complète sur Base Sepolia. Capturer
   les logs natifs si l’app se ferme ; l’accès au catalogue seul ne suffit pas.
6. Déconnexion/changement de compte : Google → passkey → wallet externe ; aucun
   contact, solde, groupe ou historique de l’utilisateur précédent ne doit
   apparaître. Révoquer toutes les sessions avec réseau indisponible : les
   écrans privés locaux doivent se fermer même si la révocation distante échoue.
7. Fermer normalement l’app et la relancer : conserver une session valide.
   Après déconnexion explicite, rester déconnecté après relancement.
8. Vérifier petit écran, clavier visible, zones tactiles du bouton Retour,
   absence de Weekly Flow et accessibilité des actions Profil.

## Fichiers principaux

- `frontend/app/security.tsx` : passkey associée, MFA et révocation.
- `frontend/providers/AuthProvider.tsx` : nettoyage, nouvelle connexion,
  annulation et signature de propriété.
- `frontend/providers/ReownExternalWalletRuntime.tsx` et
  `frontend/utils/externalWalletConnection.ts` : attente de connexion et réseau.
- `frontend/stores/useAuthStore.ts`, `frontend/utils/accountScope.ts` et stores
  contacts/groupes/historique : isolation et persistance des comptes.
- `frontend/app/(tabs)/profile.tsx` et
  `frontend/components/profile/LogoutModal.tsx` : actions utilisateur.
- `backend/app.ts` et `backend/tests/routeAuth.test.js` : association publique.
- `frontend/scripts/security-flows.test.cjs` et `onboarding.test.cjs` : régressions.

## Documentation officielle consultée

- [Privy — enrollment TOTP](https://docs.privy.io/authentication/user-authentication/mfa/enrollment/totp).
- [Privy — configuration MFA](https://docs.privy.io/authentication/user-authentication/mfa/setup).
- [Reown — installation React Native](https://docs.reown.com/appkit/react-native/core/installation).

Versions installées examinées : Privy Expo 0.72.0, Reown React Native 2.0.6,
Expo 54.0.37, React Native 0.81.5 et viem 2.56.0. Aucun SDK mis à jour dans ce
correctif. La configuration MFA effective du dashboard reste à valider lors de
la recette réelle.
