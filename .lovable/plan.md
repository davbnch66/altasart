
## Ajouter un bouton "Nouveau reglement" sur la page detail facture

### Probleme
Le composant `CreateReglementDialog` est deja importe dans `FactureDetail.tsx` mais n'est jamais affiche dans le rendu. Il suffit de l'ajouter au bon endroit.

### Implementation

**Fichier**: `src/pages/FactureDetail.tsx`

1. Ajouter le composant `CreateReglementDialog` dans la section "Reglements", a cote du titre, en lui passant les props `preselectedFactureId={facture.id}` et `preselectedCompanyId={facture.company_id}`.

2. Ajouter l'invalidation des queries `facture-reglements` et `facture-detail` dans le `CreateReglementDialog` (`onSuccess`) pour que la liste des reglements et le solde se mettent a jour immediatement apres creation.

**Fichier**: `src/components/forms/CreateReglementDialog.tsx`

3. Ajouter les invalidations de cache supplementaires dans le `onSuccess` de la mutation :
   - `["facture-reglements"]`
   - `["facture-detail"]`

### Resultat
Un bouton "Nouveau reglement" apparaitra dans l'en-tete de la section Reglements sur la page de detail facture. Le formulaire sera pre-rempli avec la bonne facture et societe, et le montant restant sera calcule automatiquement.
