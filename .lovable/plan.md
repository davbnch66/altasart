

# Refonte du PDF Facture -- Aligner sur le style Devis

## Objectif
Refaire entierement le design du PDF de facture pour qu'il soit coherent avec le PDF de devis deja ameliore : meme logo plus grand, meme barre titre coloree, meme bloc client encadre, meme tableau de totaux, meme footer, et logo sur toutes les pages.

## Changements prevus

### 1. Logo plus grand et present sur toutes les pages
- Agrandir le logo : passer de 40x18mm a 50x22mm (comme pour le devis)
- Ajouter le logo en haut de chaque page du PDF (actuellement il n'est que sur la page 1)

### 2. En-tete (Header)
- Remplacer le texte "Specialiste en Manutention Lourde" par le tagline du devis : "Transport - Grutage - Portage - Levage - Manutention lourde"
- Ajouter la date en haut a droite avec alignement identique au devis

### 3. Barre titre coloree
- Remplacer le rectangle gris avec bordure noire par une barre arrondie avec fond de couleur brand (orange 200,80,30) et texte blanc, identique au devis
- Texte : "FACTURE N° XXX" centre

### 4. Bloc client encadre
- Remplacer le texte client brut par un encadre arrondi cote droit (meme style que le devis)
- Informations entreprise a gauche avec meme mise en forme

### 5. Section references et description
- Garder les references (client, dossier, devis) mais avec le meme espacement et style de police
- Encadrer la description/notes dans un bloc propre

### 6. Tableau TVA et Totaux
- Utiliser le meme style de tableau que le devis : en-tete brand color, lignes alternees
- Bloc totaux a droite avec fond gris clair pour HT et TVA, fond brand pour TTC

### 7. Mentions legales et paiement
- Conserver le montant en lettres, les penalites de retard, l'echeance et le reste du
- Mise en forme coherente avec le devis (tailles de police, couleurs)

### 8. Footer identique
- Reutiliser la fonction `drawFooter` du fichier devis (ou la copier dans le fichier facture)
- Meme ligne brand, meme infos centrees

### 9. Nettoyage technique
- Utiliser `fmtEur` deja en place (pas de slash)
- Supprimer les caracteres speciaux non supportes par Helvetica (remplacer les accents dans le PDF par des equivalents ASCII la ou ca pose probleme, ou les garder si ca fonctionne)
- Extraire `drawFooter` et `drawHeader` en fonctions reutilisables

---

## Detail technique

### Fichier modifie
- `src/lib/generateFacturePdf.ts` : refonte complete du rendu

### Structure du code refactorise

```text
generateFacturePdf()
  |-- Fetch data (facture, client, company, devis, dossier)
  |-- Calculs (HT, TVA, TTC, reste du)
  |-- Page 1
  |    |-- drawHeader(doc, company, logoResult) -- logo + tagline
  |    |-- Barre titre "FACTURE N° XXX"
  |    |-- Bloc client (encadre a droite) + infos societe (gauche)
  |    |-- References (client, dossier, devis)
  |    |-- Description / notes
  |    |-- Tableau TVA (header brand, ligne de donnees)
  |    |-- Bloc totaux (HT, TVA, TTC)
  |    |-- Paiement (echeance, reste du)
  |    |-- Mentions legales
  |    |-- drawFooter()
  |-- doc.save()
```

### Points cles
- Logo max 50x22mm avec ratio preserve (via `loadCompanyLogo`)
- Couleur brand : RGB(200, 80, 30)
- `fmtEur()` pour tous les montants (pas d'Intl)
- `drawFooter()` copie du devis pour coherence
- Pas de page 2 pour la facture (pas de CGV necessaires)

