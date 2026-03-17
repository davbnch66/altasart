# Email Bridge — Guide de déploiement

## Architecture

```
┌──────────────────────┐    HTTPS/REST     ┌──────────────────┐    IMAP/SMTP    ┌──────────────┐
│  SaaS (Lovable Cloud)│ ◄────────────────► │  Email Bridge    │ ◄──────────────► │ Mail Servers │
│                      │                    │  (Node.js)       │                  │ Gandi, Gmail │
│  email_accounts      │ ←── sync push      │  IMAP polling    │                  │ OVH, Outlook │
│  synced_emails       │ ←── outbox poll    │  SMTP sending    │                  │ Zoho, etc.   │
│  email_outbox        │ ←── test results   │  Connection test │                  └──────────────┘
│  Edge Functions ×5   │                    └──────────────────┘
└──────────────────────┘
```

## Ce qui est prêt dans le SaaS

### Base de données
- ✅ `email_accounts` — Configuration IMAP/SMTP par société avec chiffrement AES-256-GCM
- ✅ `synced_emails` — Stockage des emails synchronisés + rattachement client automatique
- ✅ `email_outbox` — File d'attente des emails à envoyer
- ✅ RLS strict sur toutes les tables (company-scoped)

### Edge Functions (déployées)
- ✅ `encrypt-email-password` — Chiffre les mots de passe avant stockage
- ✅ `email-bridge-accounts` — Fournit la liste des comptes actifs au bridge
- ✅ `email-bridge-sync` — Reçoit les emails synchronisés par le bridge
- ✅ `email-bridge-send` — Queue d'envoi + polling + confirmation
- ✅ `email-bridge-test` — Test de connexion IMAP/SMTP

### Interface
- ✅ Onglet "Connexions" dans Paramètres
- ✅ Formulaire complet avec presets fournisseurs
- ✅ Mots de passe jamais affichés (masqués côté UI)
- ✅ Statut de connexion en temps réel
- ✅ Bouton tester / modifier / supprimer

### Sécurité
- ✅ Mots de passe chiffrés AES-256-GCM côté serveur
- ✅ Aucun secret en clair dans les logs (pino redact)
- ✅ Aucun secret réaffiché dans l'interface
- ✅ Auth webhook par `X-Bridge-Secret`
- ✅ Auth JWT pour les endpoints frontend

---

## Déploiement du bridge sur Railway

### 1. Prérequis
- Compte Railway (https://railway.app)
- Le dossier `email-bridge/` du projet

### 2. Variables d'environnement à configurer sur Railway

| Variable | Description | Exemple |
|---|---|---|
| `SUPABASE_FUNCTIONS_URL` | URL des Edge Functions | `https://bsqqdtqzxajecgxgulce.supabase.co/functions/v1` |
| `EMAIL_BRIDGE_SECRET` | Secret partagé avec le SaaS | Même valeur que dans Lovable Cloud |
| `ENCRYPTION_KEY` | Clé AES-256 (64 chars hex) | Même valeur que `EMAIL_ENCRYPTION_KEY` dans Lovable Cloud |
| `POLL_INTERVAL_MS` | Intervalle de polling (ms) | `60000` (1 minute) |
| `MAX_EMAILS_PER_SYNC` | Emails max par sync | `50` |
| `IMAP_FETCH_DAYS_BACK` | Jours en arrière au 1er sync | `7` |
| `LOG_LEVEL` | Niveau de log | `info` |

### 3. Déploiement

```bash
cd email-bridge
npm install
npm run build

# Sur Railway :
railway init
railway up
```

Ou via le Dockerfile inclus :
- Railway détecte automatiquement le `Dockerfile`
- Build command: `docker build -t email-bridge .`
- Start command: `node dist/index.js`

### 4. Vérification

Une fois déployé, le bridge :
1. Log `Email Bridge starting` au démarrage
2. Interroge les comptes actifs toutes les 60s
3. Synchronise les emails IMAP → SaaS
4. Envoie les emails en queue SMTP
5. Traite les demandes de test de connexion

---

## Flux complets

### Réception d'un email
1. Le bridge se connecte en IMAP au serveur mail
2. Récupère les messages depuis `last_sync_at`
3. Parse les emails (headers, corps, pièces jointes)
4. Déduplique par `message_id`
5. POST vers `email-bridge-sync` → stockage dans `synced_emails`
6. Rattachement automatique au client si l'email correspond

### Envoi d'un email
1. L'utilisateur compose un email dans le SaaS
2. Le frontend appelle `email-bridge-send` (POST, JWT)
3. L'email est mis en queue dans `email_outbox`
4. Le bridge poll `email-bridge-send?action=poll`
5. Envoie via SMTP avec nodemailer
6. Confirme via `email-bridge-send?action=confirm`
7. L'email est enregistré dans `synced_emails` + `messages`

### Test de connexion
1. L'utilisateur clique "Tester" dans l'interface
2. POST vers `email-bridge-test` → statut passe à `testing`
3. Le bridge poll les comptes en test
4. Teste SMTP (verify) et IMAP (connect + list)
5. POST résultat → statut passe à `active` ou `error`

---

## Structure du service

```
email-bridge/
├── package.json
├── tsconfig.json
├── Dockerfile
└── src/
    ├── index.ts           # Point d'entrée + cron
    ├── config.ts          # Variables d'environnement
    ├── api/
    │   └── supabase.ts    # Client API vers Edge Functions
    ├── imap/
    │   ├── connector.ts   # Connexion IMAP + fetch + test
    │   └── poller.ts      # Polling multi-comptes + dédup
    ├── smtp/
    │   └── sender.ts      # Envoi SMTP via nodemailer
    ├── test/
    │   └── tester.ts      # Test IMAP + SMTP
    └── utils/
        ├── crypto.ts      # AES-256-GCM encrypt/decrypt
        ├── logger.ts      # Pino avec redaction des secrets
        └── parser.ts      # Parse MIME emails
```
