

# Configuration de l'envoi d'emails via SMTP Outlook

## Objectif
Configurer les secrets SMTP_USER et SMTP_PASS pour activer l'envoi de rapports de visite par email depuis l'application.

## Ce qui existe deja
- La fonction backend `send-visite-email` est deja implementee et configuree pour se connecter a `smtp.office365.com` (port 587, TLS).
- L'interface d'envoi d'email (boite de dialogue avec destinataire, objet, message et piece jointe PDF) est en place dans l'application.
- Il ne manque que les identifiants SMTP pour activer le tout.

## Etapes

1. **Ajout du secret SMTP_USER** : Vous serez invite a saisir l'adresse email Outlook complete (ex: `votre-adresse@outlook.com` ou `votre-adresse@hotmail.com`).

2. **Ajout du secret SMTP_PASS** : Vous serez invite a saisir le mot de passe du compte Outlook (ou le mot de passe d'application si l'authentification a deux facteurs est activee).

3. **Test de l'envoi** : Une fois les secrets configures, on testera l'envoi d'un email depuis une fiche visite pour verifier que tout fonctionne.

## Note importante
Si votre compte Outlook a l'authentification a deux facteurs activee, il faudra generer un "mot de passe d'application" depuis les parametres de securite du compte Microsoft, et utiliser ce mot de passe au lieu du mot de passe habituel.

## Section technique
- Les secrets sont stockes de maniere securisee et accessibles uniquement par les fonctions backend.
- Aucune modification de code n'est necessaire, la fonction `send-visite-email` utilise deja `Deno.env.get("SMTP_USER")` et `Deno.env.get("SMTP_PASS")`.
- Le changement ulterieur de compte email se fera simplement en mettant a jour ces deux secrets.

