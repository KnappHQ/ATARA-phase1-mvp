# Accès ATARA par des agents IA — garde-fous avant activation

L'accès agent **n'est pas activé** dans la bêta. `backend/utils/agentAccessPolicy.ts`
définit uniquement les capacités de lecture envisagées ; aucun endpoint, jeton
d'agent ni pouvoir de signature n'est exposé par ce changement.

Avant de proposer un serveur MCP ou une application IA : authentification
déléguée distincte de la session mobile (OAuth 2.1 avec PKCE), consentement
explicite par agent et par portée, jetons courts liés à l'audience, révocation
immédiate, journal consultable, quotas par agent/utilisateur/IP et défense contre
les requêtes abusives. Ne jamais transmettre les secrets Privy, clés privées,
seed phrases, cookies de session ou permissions de signature à l'agent.

La préparation d'un paiement peut produire un brouillon **sans transaction**.
Toute opération qui engage des fonds devra être revue séparément : simulation,
plafonds par opération/jour, destinataire vérifié et confirmation explicite dans
l'application par l'utilisateur. Aucun agent ne peut contourner cette confirmation.

Critères de lancement : audit de sécurité et juridique, tests anti-rejeu,
isolation inter-comptes, retrait de consentement, injection de prompt, rafales
de requêtes, et tests physiques iOS/Android. Le backend doit refuser toute
capacité non listée, même si le client la demande.
