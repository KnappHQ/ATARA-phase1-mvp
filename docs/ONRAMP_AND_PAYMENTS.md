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
