
# Reorganisation de la page Visite -- Interface simplifiee et chronologique

## Probleme actuel
La page visite contient **12 onglets** (RDV, Visite, Pieces, Materiel, Affectation, RH, Vehicules, Acces, Methodo, Dossier, Devis, Instructions), ce qui rend la navigation confuse et contre-productive sur le terrain. De plus, la methodologie est entierement manuelle.

## Nouvelle organisation : 4 onglets chronologiques

L'idee est de regrouper les sections par **phase logique du processus de visite**, avec des blocs deroulants (Collapsible) a l'interieur de chaque onglet.

### Onglet 1 : "Rendez-vous" (avant la visite)
Sections deroulantes :
- **Rendez-vous** : date, heure, duree, zone, conseiller, coordinateur
- **Client** : infos en lecture seule (lien vers la fiche)
- **Adresses** : origine et destination (avec les options ascenseur, monte-meubles, portage, etc.)
- **Informations complementaires** : periode, distance, volume, nature, type operation, type devis, tractionnaire

### Onglet 2 : "Site" (pendant la visite sur le terrain)
Sections deroulantes :
- **Pieces / Zones** : liste des pieces avec ajout rapide. Les **photos** restent associees aux pieces mais avec un champ **legende/description** sous chaque photo
- **Inventaire materiel** : tableau du materiel avec import IA. Ajout de **listes deroulantes** pour les designations courantes (Armoire, Bureau, Carton, Coffre-fort, Piano, Machine, etc.) en plus de la saisie libre
- **Affectation** : affecter le materiel aux pieces (integre directement, visible si pieces + materiel existent)
- **Contraintes d'acces** : portes, escaliers, monte-charge, rampe, obstacles, autorisations

### Onglet 3 : "Moyens & Methodologie" (planification)
Sections deroulantes :
- **Ressources humaines** : equipe necessaire
- **Vehicules et engins** : moyens de transport et levage
- **Methodologie IA** : remplacement de la methodologie manuelle par une **generation automatique par l'IA** qui :
  - Analyse le materiel, les contraintes, les RH et vehicules saisis
  - Propose une methodologie conforme aux reglementations (Code du travail, normes de levage, securite)
  - Suggere le materiel a louer chez les confreres si necessaire
  - Inclut des schemas textuels (diagrammes ASCII) pour les operations complexes
  - Genere une checklist de securite adaptee
  - Reste **editable** par l'utilisateur avant validation (validation humaine obligatoire)
- **Instructions** : notes libres pour l'equipe (fusionne l'ancien onglet "Instructions")

### Onglet 4 : "Devis & Dossier" (apres la visite)
Sections deroulantes :
- **Memo devis** : notes pour le devis
- **Historique des devis IA** : generation et comparaison
- **Dossier** : codification complementaire, lien/creation de dossier

## Fonctionnalites ameliorees

### Listes deroulantes pour le materiel
Ajout d'un `<select>` avec des designations predefinies courantes (Armoire haute, Armoire basse, Bureau, Caisson, Carton standard, Carton livres, Chaise, Coffre-fort, Commode, Fauteuil, Machine a laver, Piano droit, Piano a queue, Refrigerateur, Table, etc.) avec une option "Autre (saisie libre)".

### Description sous les photos
Ajout d'un champ `caption` editable sous chaque photo dans les pieces, utilisant le champ `caption` deja existant dans la table `visite_photos`.

### Methodologie generee par IA
Nouvelle edge function `generate-methodologie` qui :
1. Recupere toutes les donnees de la visite (materiel, poids, contraintes, RH, vehicules)
2. Envoie le contexte a l'IA avec un prompt specialise incluant les references reglementaires
3. Genere :
   - Un texte de methodologie structure et clair
   - Des suggestions de materiel a louer si les moyens actuels sont insuffisants
   - Une checklist de securite conforme
   - Des schemas descriptifs pour les operations de levage ou acces complexes
4. L'utilisateur peut modifier le resultat avant de l'enregistrer

## Details techniques

### Fichiers modifies
- `src/pages/VisiteDetail.tsx` : restructuration complete (4 onglets au lieu de 12, sections Collapsible)
- `src/components/visite/VisitePiecesTab.tsx` : ajout du champ legende editable sous les photos
- `src/components/visite/VisiteMaterielTab.tsx` : ajout du select de designations predefinies
- `src/components/visite/VisiteMethodologieTab.tsx` : refonte avec bouton "Generer par IA" + affichage structure

### Nouveaux fichiers
- `supabase/functions/generate-methodologie/index.ts` : edge function IA pour generer la methodologie

### Modifications de configuration
- `supabase/config.toml` : ajout de la nouvelle edge function

### Architecture des sections deroulantes
Chaque section utilise le composant `Collapsible` de Radix UI deja installe, avec un en-tete cliquable affichant une icone et un compteur (ex: "Materiel (12 elements)"). La premiere section de chaque onglet est ouverte par defaut.

### Barre flottante mobile
Mise a jour pour refleter les 4 nouveaux onglets : RDV, Site, Moyens, Devis + boutons Photo et Sauver.
