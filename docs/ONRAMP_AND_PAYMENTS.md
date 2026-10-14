# Ajouter des crypto et payer en bêta

ATARA garde le portefeuille non custodial : MoonPay achète les actifs et les
envoie directement à l’adresse smart account. Le backend ne reçoit ni carte, ni
clé privée, ni fonds. Il ne fait que générer l’URL MoonPay signée lorsque les
clés du fournisseur sont configurées.

Le paiement magasin utilise le même flux d’envoi smart account déjà utilisé par
ATARA. Le montant est converti en six décimales USDC, le bundle est confirmé
avant d’être marqué réussi, puis l’activité est synchronisée avec le backend.
Un identifiant de bundle est conservé sur le téléphone pendant l’attente pour
reprendre un paiement après fermeture de l’app.

Le choix de MoonPay pour la bêta réduit le code spécifique côté mobile et garde
la conformité d’achat chez un prestataire spécialisé. Le fournisseur reste
configurable : son code de devise, son environnement sandbox et son endpoint
peuvent changer sans modifier le contrat Vault.

## Mode simulation

Pour une démonstration locale, active `EXPO_PUBLIC_DEMO_MODE=true` dans le
projet Expo. Les parcours « Ajouter des crypto », « Payer une course » et
Vault utilisent alors des données fictives et affichent clairement le mode
simulation. Aucun appel MoonPay, aucune signature de bundle et aucune
transaction blockchain ne sont exécutés.

## MoonPay : IP matching et vue intégrée (sandbox)

Référence : documentation MoonPay « IP matching » et « URL signing ».

### Ce que fait le backend

- `POST /api/v1/wallet/onramp-session` (route inchangée, protections sandbox
  inchangées) lit l’IP publique du client **sur la requête reçue**, jamais dans
  le body ni dans un header choisi par l’app.
- L’IP est mise sous forme canonique (`backend/utils/clientIp.ts`) : IPv4 sans
  zéros non significatifs, IPv6 RFC 5952 en minuscules, `::ffff:a.b.c.d` démappée
  en IPv4, sans port ni crochets. Une IP privée, loopback, CGNAT ou de
  documentation est refusée.
- `allowedIpAddress` = base64(HMAC-SHA256(clé secrète MoonPay, IP canonique)),
  ajouté **avant** la signature de la query complète (`signature` reste le
  dernier paramètre). Au plus deux hashes, un par famille, uniquement pour des
  IP réellement observées ; en pratique une requête n’en voit qu’une.
- Sans IP publique observée, aucune session n’est créée : réponse 503,
  code `MP-IP-UNAVAILABLE` (`MP-IP-AMBIGUOUS` si deux IP de même famille).
- Les logs indiquent seulement `ipHashes` et `ipFamilies` : jamais l’IP, le
  hash, une clé ni l’URL signée.

### Source de l’IP (`MOONPAY_CLIENT_IP_SOURCE`)

- `forwarded` (défaut) : `req.ip` d’Express avec `trust proxy = 1`, c’est-à-dire
  l’adresse ajoutée par le seul proxy de confiance (Render) à la fin de
  `X-Forwarded-For`. Une valeur que le client met lui-même dans
  `X-Forwarded-For` est ignorée.
- `true-client-ip` : header recommandé par MoonPay. À n’activer **qu’après**
  la vérification ci-dessous, car s’il n’est pas réécrit par le proxy,
  n’importe quel client peut le choisir.

### Vérifier la source de l’IP sur Render (à faire avant d’activer le parcours)

1. Avec un token de session d’un compte de test, depuis une connexion connue
   (noter l’IP publique, par exemple via la page « What is my IP » de l’opérateur) :
   `curl -s -H "Authorization: Bearer $TOKEN" https://<api>/api/v1/wallet/onramp-ip-check`
2. Recommencer en falsifiant les headers :
   `curl -s -H "Authorization: Bearer $TOKEN" -H "True-Client-IP: 8.8.8.8" -H "X-Forwarded-For: 8.8.4.4" https://<api>/api/v1/wallet/onramp-ip-check`
3. Lecture : `used.ip` doit rester l’IP réelle dans les deux cas. Si
   `sources.trueClientIp` vaut `8.8.8.8` au deuxième appel, Render ne réécrit
   pas ce header : garder `forwarded`. Si `sources.expressIp` vaut `8.8.4.4`,
   il y a plus d’un proxy devant l’app : ne pas activer le parcours et revoir
   `trust proxy`.
4. La réponse n’est renvoyée qu’à la personne authentifiée et n’est pas
   journalisée. Ne pas coller ces réponses dans un ticket public.

### Devise et réseau

Le support MoonPay a confirmé (deux fois) que `usdc_base` **n’est pas disponible
en sandbox**. Configuration, sans changement de code :

- **Sandbox** : `MOONPAY_CURRENCY_CODE=eth` sur le backend (ETH sur **Ethereum
  Sepolia**). Ce n’est pas Base Sepolia : un éventuel envoi de test arrive sur
  Ethereum Sepolia, à l’adresse du smart account, et n’apparaît donc pas dans le
  solde de l’app (qui lit Base Sepolia). L’app le dit sans nommer de jeton.
- **Production (plus tard)** : `usdc_base` reste la valeur par défaut du code.

L’adresse de réception est toujours le smart account de la personne
authentifiée, vérifiée côté serveur. Le parcours reste masqué dans les builds
store-beta : `EXPO_PUBLIC_ENABLE_CARD_PURCHASE` est refusé par le preflight.

### Vue intégrée dans l’app

- L’URL signée est ouverte **telle quelle** dans `react-native-webview`
  (`frontend/components/addMoney/MoonPayCheckout.tsx`), plus dans
  SFSafariViewController. WKWebView ne passe pas par iCloud Private Relay :
  MoonPay voit la même IP que celle hashée. L’exception « Private Relay »
  (omettre `allowedIpAddress`) ne concerne que Safari et les vues Safari ;
  elle n’est donc pas utilisée.
- Apple Pay : WKWebView le désactive dès qu’un script est injecté.
  react-native-webview injecte un shim d’historique par défaut, d’où
  `enableApplePay` et l’absence de `injectedJavaScript`, `onMessage`,
  `injectJavaScript`.
- Navigation : arrivée sur `redirectURL` → fermeture ; autre https → chargé ;
  `mailto:`, `tel:`, liens d’app → iOS ; `http:`, `javascript:` → bloqués.
- Fermer (bouton, geste, redirection) marque le retour et relance la lecture
  du solde. Erreur réseau, erreur HTTP ou chargement > 20 s → message +
  « Try again » (nouvelle session, l’IP a pu changer) ou « Close ».

### Protocole TestFlight (non exécuté à ce jour)

Prérequis : build contenant cette PR, backend avec clés **sandbox**,
`EXPO_PUBLIC_ENABLE_CARD_PURCHASE` activé uniquement sur le build de test,
vérification Render ci-dessus faite, `MOONPAY_CURRENCY_CODE=eth` sur le backend sandbox. Aucun achat réel, aucun mainnet.

1. Wi-Fi, sans VPN : Add crypto → « Try MoonPay (sandbox) ». Attendu : la vue
   s’ouvre dans l’app, pas d’écran « Unverified Connection ».
2. Double tap rapide sur le bouton : une seule session, une seule vue.
3. Fermer avec la croix, puis avec le geste retour : retour à l’écran,
   message de retour, bouton de nouveau actif.
4. Parcours sandbox complet avec la carte de test MoonPay ; vérifier la
   redirection et la fermeture automatique.
5. Apple Pay (si proposé en sandbox) : la feuille Apple Pay s’affiche ; noter
   le résultat exact, même négatif.
6. Mode avion pendant le chargement : message « No connection », Retry/Close.
7. Ouvrir la vue en Wi-Fi, passer en 4G/5G, continuer : noter si MoonPay
   affiche « Unverified Connection » (attendu, l’IP a changé) puis Retry.
8. iCloud Private Relay activé : refaire l’étape 1 (WKWebView ne doit pas
   être affecté).
9. Vérifier dans les logs Render qu’aucune IP, aucun hash ni aucune URL
   signée n’apparaît (`ipHashes`, `ipFamilies` seulement).

Reporter pour chaque étape : modèle d’iPhone, version iOS, réseau, résultat,
code de référence affiché le cas échéant.
