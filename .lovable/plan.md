

# Automatisation du traitement des emails entrants

Ce projet est ambitieux et touche a de nombreux aspects de l'application. Pour garantir une implementation solide et incrementale, je propose de le decouper en **4 phases**.

---

## Phase 1 -- Reception et stockage des emails (Webhook)

La premiere etape consiste a creer un point d'entree pour recevoir les emails entrants via un webhook. Resend sera utilise en premier, avec une migration vers Gmail/Outlook prevue plus tard.

### Base de donnees

**Nouvelle table `inbound_emails`** pour stocker les emails bruts avant traitement :
- `id`, `company_id`, `from_email`, `from_name`, `to_email`, `subject`, `body_text`, `body_html`
- `attachments` (jsonb -- noms de fichiers, URLs storage)
- `status` (enum: `pending`, `processing`, `processed`, `error`)
- `ai_analysis` (jsonb -- resultat de l'analyse IA)
- `client_id` (nullable -- rattachement apres analyse)
- `dossier_id`, `devis_id`, `visite_id` (nullable -- associations)
- `processed_at`, `created_at`
- RLS policies pour les membres de la company

**Nouvelle table `email_actions`** pour les actions suggerees par l'IA :
- `id`, `inbound_email_id`, `company_id`
- `action_type` (enum: `create_client`, `create_dossier`, `create_devis`, `plan_visite`, `extract_materiel`, `link_dossier`)
- `status` (enum: `suggested`, `accepted`, `rejected`)
- `payload` (jsonb -- donnees pre-remplies)
- `executed_at`, `executed_by`

**Modification table `messages`** : ajouter colonne `inbound_email_id` (nullable) pour lier un message a l'email brut d'origine.

### Edge Function `process-inbound-email`

1. Recoit le webhook (email brut)
2. Stocke dans `inbound_emails`
3. Appelle l'IA (Lovable AI / Gemini) pour analyser :
   - Extraction : societe, contact, email, telephone, adresse chantier
   - Detection : demande de devis, demande de visite, liste de materiel, urgence
4. Recherche le client par email dans la base
5. Si client trouve : rattache
6. Si non : cree une action suggeree `create_client` avec donnees pre-remplies
7. Genere les actions suggerees (create_dossier, plan_visite, extract_materiel, etc.)
8. Insere le message dans la table `messages` pour l'historique

---

## Phase 2 -- Interface Inbox intelligente

Transformer la page Inbox actuelle (donnees mock) en une vraie interface connectee a la base.

### Page InboxPage refonte complete

- **Liste des emails** : query sur `inbound_emails` + `messages`, filtres par statut, canal, client
- **Vue detail email** : affichage complet du contenu, pieces jointes, analyse IA
- **Bandeau d'actions rapides** avec boutons :
  - Creer client
  - Creer dossier
  - Creer devis
  - Planifier visite
  - Extraire materiel
  - Associer dossier existant
- Chaque bouton pre-remplit les dialogues existants (`CreateClientDialog`, `CreateDossierDialog`, etc.) avec les donnees extraites par l'IA
- **Badge de notification** dans la sidebar pour les emails non traites

### Composants a creer

- `InboxEmailDetail.tsx` -- vue detail d'un email avec analyse IA
- `InboxActionBar.tsx` -- barre d'actions contextuelles
- `InboxAiSummary.tsx` -- affichage du resume IA (entites detectees, actions suggerees)

---

## Phase 3 -- Onglet Echanges dans la fiche client

### Modification de `ClientDetail.tsx`

- Ajouter un onglet **"Echanges"** dans les tabs existants
- Afficher tous les `messages` lies au client en ordre chronologique
- Vue type messagerie : emails entrants (gauche), emails sortants (droite)
- Pieces jointes visibles
- Lien vers le dossier/devis/visite associe
- Possibilite de repondre directement (avec assistance IA pour la redaction)

---

## Phase 4 -- Workflow planning et notifications

### Validation planning

- Quand une demande de visite est detectee par l'IA, une suggestion apparait dans l'inbox
- Le commercial valide et selectionne un creneau
- Email de confirmation envoye automatiquement au client (avec validation humaine du contenu)
- Si date indisponible : proposition de creneaux alternatifs

### Notifications internes

**Nouvelle table `notifications`** :
- `id`, `company_id`, `user_id`, `type` (enum), `title`, `body`, `read`, `link`, `created_at`

Types : `new_lead`, `materiel_detected`, `visite_requested`, `client_response`, `date_to_validate`

- Icone cloche dans la sidebar avec badge compteur
- Liste deroulante des notifications recentes

---

## Details techniques

### Migrations SQL necessaires

```text
1. CREATE TYPE inbound_email_status AS ENUM ('pending','processing','processed','error')
2. CREATE TYPE email_action_type AS ENUM ('create_client','create_dossier','create_devis','plan_visite','extract_materiel','link_dossier')  
3. CREATE TYPE email_action_status AS ENUM ('suggested','accepted','rejected')
4. CREATE TABLE inbound_emails (...)
5. CREATE TABLE email_actions (...)
6. ALTER TABLE messages ADD COLUMN inbound_email_id uuid REFERENCES inbound_emails(id)
7. CREATE TABLE notifications (...)
8. RLS policies pour chaque table
9. ALTER PUBLICATION supabase_realtime ADD TABLE notifications (temps reel)
```

### Edge Functions

| Fonction | Role |
|----------|------|
| `process-inbound-email` | Reception webhook, analyse IA, creation actions |
| `execute-email-action` | Execution d'une action validee par l'utilisateur |
| `send-visite-email` (existant) | Envoi emails sortants (confirmation visite, etc.) |
| `draft-email` (existant) | Redaction assistee par IA |

### Modele IA utilise

- `google/gemini-3-flash-preview` via Lovable AI Gateway
- Tool calling pour extraction structuree (meme pattern que `import-materiel`)
- Schema : societe, contact, email, telephone, adresse, type_demande, materiel[], date_souhaitee, urgence

### Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `supabase/functions/process-inbound-email/index.ts` | Creer |
| `supabase/functions/execute-email-action/index.ts` | Creer |
| `src/pages/InboxPage.tsx` | Refonte complete |
| `src/components/inbox/InboxEmailDetail.tsx` | Creer |
| `src/components/inbox/InboxActionBar.tsx` | Creer |
| `src/components/inbox/InboxAiSummary.tsx` | Creer |
| `src/components/client/ClientExchangesTab.tsx` | Creer |
| `src/pages/ClientDetail.tsx` | Ajouter onglet Echanges |
| `src/components/AppSidebar.tsx` | Badge notifications |
| `src/components/NotificationBell.tsx` | Creer |
| `supabase/config.toml` | Ajouter fonctions |

### Ordre d'implementation recommande

1. Migrations SQL (tables + enums + RLS)
2. Edge Function `process-inbound-email` avec analyse IA
3. Refonte InboxPage connectee a la base
4. Vue detail email + actions rapides
5. Onglet Echanges dans ClientDetail
6. Edge Function `execute-email-action`
7. Notifications (table + composant cloche)
8. Workflow planning (validation, envoi confirmation)

Toutes les actions suggerees par l'IA sont soumises a validation humaine avant execution.

