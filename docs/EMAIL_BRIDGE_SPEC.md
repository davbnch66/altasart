# Email Bridge — Service Externe Node.js

## Architecture

```
┌─────────────────────┐     HTTPS/REST      ┌──────────────────┐     IMAP/SMTP     ┌──────────────┐
│   SaaS (Lovable)    │ ◄──────────────────► │   Email Bridge   │ ◄───────────────► │  Mail Servers │
│                     │                      │  (Node.js)       │                   │  Gandi, Gmail │
│  - email_accounts   │  POST /sync          │  - IMAP polling  │                   │  OVH, etc.    │
│  - synced_emails    │  GET /send?poll       │  - SMTP sending  │                   └──────────────┘
│  - email_outbox     │  POST /send?confirm   │  - Connection    │
│  - Edge Functions   │  GET /test?poll       │    testing       │
└─────────────────────┘  POST /test?result    └──────────────────┘
```

## Endpoints API (Edge Functions)

Toutes les URLs sont :  
`https://bsqqdtqzxajecgxgulce.supabase.co/functions/v1/{function}`

### Authentication Bridge
Toutes les requêtes du bridge doivent inclure :
```
X-Bridge-Secret: <votre EMAIL_BRIDGE_SECRET>
```

---

### 1. `email-bridge-sync` — Pousser des emails reçus

**POST** `/functions/v1/email-bridge-sync`

```json
{
  "account_id": "uuid-du-compte-email",
  "emails": [
    {
      "message_id": "<abc123@mail.example.com>",
      "direction": "inbound",
      "from_email": "client@example.com",
      "from_name": "Jean Dupont",
      "to_emails": [{ "email": "inbox@entreprise.fr", "name": "Entreprise" }],
      "cc_emails": [],
      "subject": "Demande de devis",
      "body_text": "Bonjour, je souhaite...",
      "body_html": "<p>Bonjour, je souhaite...</p>",
      "attachments": [
        { "filename": "plan.pdf", "content_type": "application/pdf", "size": 12345 }
      ],
      "received_at": "2026-03-17T10:30:00Z",
      "folder": "INBOX"
    }
  ]
}
```

**Réponse** : `{ "success": true, "inserted": 5, "skipped": 0, "linked": 3 }`

---

### 2. `email-bridge-send` — Récupérer les emails à envoyer

**GET** `/functions/v1/email-bridge-send?action=poll`  
Headers : `X-Bridge-Secret: xxx`

**Réponse** :
```json
{
  "emails": [
    {
      "id": "outbox-uuid",
      "account_id": "account-uuid",
      "to_recipients": [{ "email": "dest@example.com" }],
      "subject": "Votre devis",
      "body_html": "<p>...</p>",
      "email_accounts": {
        "smtp_host": "mail.gandi.net",
        "smtp_port": 587,
        "smtp_security": "STARTTLS",
        "smtp_username": "inbox@entreprise.fr",
        "smtp_password_encrypted": "password-en-clair"
      }
    }
  ]
}
```

**POST** `/functions/v1/email-bridge-send?action=confirm`
```json
{
  "queue_id": "outbox-uuid",
  "success": true,
  "sent_message_id": "<generated-id@mail.example.com>"
}
```

---

### 3. `email-bridge-test` — Tester une connexion

**GET** `/functions/v1/email-bridge-test?action=poll`  
Retourne les comptes en statut `testing`.

**POST** `/functions/v1/email-bridge-test?action=result`
```json
{
  "account_id": "uuid",
  "smtp_ok": true,
  "imap_ok": true,
  "error": null
}
```

---

## Structure du Service Node.js

```
email-bridge/
├── package.json
├── src/
│   ├── index.ts              # Entry point, orchestrateur
│   ├── config.ts             # Env vars, constants
│   ├── api/
│   │   └── supabase.ts       # Client API vers les Edge Functions
│   ├── imap/
│   │   ├── connector.ts      # Connexion IMAP générique
│   │   └── poller.ts         # Polling loop par compte
│   ├── smtp/
│   │   └── sender.ts         # Envoi SMTP via nodemailer
│   ├── test/
│   │   └── tester.ts         # Test IMAP+SMTP pour un compte
│   └── utils/
│       ├── parser.ts         # Parse MIME emails
│       └── logger.ts         # Structured logging
└── Dockerfile
```

### Dépendances recommandées
- `imapflow` — Client IMAP moderne
- `nodemailer` — Envoi SMTP
- `mailparser` — Parse MIME
- `node-cron` — Scheduling interne

### Boucle principale
```
toutes les 60 secondes :
  1. GET /email-bridge-test?action=poll → tester les comptes
  2. Pour chaque compte actif avec sync_enabled :
     - Connecter IMAP
     - Fetch les nouveaux messages (depuis last_sync_at)
     - POST /email-bridge-sync avec les emails
  3. GET /email-bridge-send?action=poll → récupérer la queue
  4. Pour chaque email en queue :
     - Envoyer via SMTP
     - POST /email-bridge-send?action=confirm
```

### Variables d'environnement du bridge
```
SUPABASE_FUNCTIONS_URL=https://bsqqdtqzxajecgxgulce.supabase.co/functions/v1
EMAIL_BRIDGE_SECRET=<même valeur que dans Lovable Cloud>
POLL_INTERVAL_MS=60000
```

## Sécurité
- Les mots de passe sont stockés en clair dans `email_accounts` (champ `*_password_encrypted`). 
  À terme, implémenter un chiffrement AES avec une clé stockée dans Vault.
- Le bridge secret empêche les appels non autorisés aux Edge Functions.
- Le bridge ne doit jamais exposer les credentials en logs.

## Déploiement Railway
```bash
railway init
railway up
```

Ou Dockerfile :
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```
