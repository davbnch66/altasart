// Predefined visit templates by operation type
export interface VisiteTemplate {
  id: string;
  label: string;
  description: string;
  operationType: string;
  methodologie: {
    content: string;
    checklist: { text: string; done: boolean }[];
  };
  rh: { role: string; quantity: number; duration_estimate: string; notes: string }[];
  vehicules: { type: string; label: string; capacity: number | null; notes: string }[];
}

export const VISITE_TEMPLATES: VisiteTemplate[] = [
  {
    id: "demenagement",
    label: "Déménagement",
    description: "Template standard pour un déménagement résidentiel ou professionnel",
    operationType: "D",
    methodologie: {
      content: `1. Visite technique des lieux (origine et destination)
2. Inventaire détaillé du mobilier et objets
3. Évaluation du volume et du poids total
4. Identification des contraintes d'accès (escaliers, ascenseur, stationnement)
5. Préparation des protections (couvertures, cartons, film bulle)
6. Démontage du mobilier si nécessaire
7. Chargement méthodique par pièce
8. Transport sécurisé
9. Déchargement et remontage
10. Vérification finale avec le client`,
      checklist: [
        { text: "Vérifier les accès origine", done: false },
        { text: "Vérifier les accès destination", done: false },
        { text: "Inventaire complet réalisé", done: false },
        { text: "Réservation de stationnement", done: false },
        { text: "Protections murales prévues", done: false },
        { text: "Cartons fournis au client", done: false },
        { text: "État des lieux entrée/sortie", done: false },
      ],
    },
    rh: [
      { role: "Chef d'équipe", quantity: 1, duration_estimate: "1 jour", notes: "Supervision globale" },
      { role: "Manutentionnaire", quantity: 3, duration_estimate: "1 jour", notes: "" },
      { role: "Chauffeur", quantity: 1, duration_estimate: "1 jour", notes: "" },
    ],
    vehicules: [
      { type: "camion", label: "Camion déménagement", capacity: 50, notes: "Hayon élévateur" },
    ],
  },
  {
    id: "manutention_lourde",
    label: "Manutention lourde",
    description: "Levage et déplacement de charges lourdes (machines, coffres-forts...)",
    operationType: "M",
    methodologie: {
      content: `1. Reconnaissance du site et des accès
2. Étude des charges (poids, dimensions, centre de gravité)
3. Choix des moyens de levage adaptés
4. Balisage et sécurisation de la zone
5. Mise en place des équipements de levage
6. Levage et déplacement de la charge
7. Pose et calage en position finale
8. Contrôle de stabilité
9. Repli du matériel`,
      checklist: [
        { text: "Plan de levage validé", done: false },
        { text: "Résistance du sol vérifiée", done: false },
        { text: "Élingage contrôlé", done: false },
        { text: "Zone balisée et sécurisée", done: false },
        { text: "EPI vérifiés pour l'équipe", done: false },
        { text: "Autorisations obtenues", done: false },
      ],
    },
    rh: [
      { role: "Chef d'équipe", quantity: 1, duration_estimate: "1 jour", notes: "Responsable levage" },
      { role: "Grutier", quantity: 1, duration_estimate: "1 jour", notes: "" },
      { role: "Manutentionnaire", quantity: 2, duration_estimate: "1 jour", notes: "Guidage et élingage" },
    ],
    vehicules: [
      { type: "grue_mobile", label: "Grue mobile", capacity: null, notes: "Capacité selon charge" },
      { type: "camion", label: "Camion plateau", capacity: null, notes: "Transport matériel" },
    ],
  },
  {
    id: "monte_meubles",
    label: "Monte-meubles",
    description: "Opération avec monte-meubles pour étages élevés sans ascenseur",
    operationType: "MM",
    methodologie: {
      content: `1. Reconnaissance du site (façade, accès, hauteur)
2. Vérification des autorisations de stationnement
3. Installation du monte-meubles
4. Sécurisation du périmètre au sol
5. Montée/descente des meubles et cartons
6. Coordination équipe intérieur / opérateur monte-meubles
7. Démontage et repli`,
      checklist: [
        { text: "Arrêté de stationnement obtenu", done: false },
        { text: "Façade accessible vérifiée", done: false },
        { text: "Fenêtre d'accès identifiée", done: false },
        { text: "Hauteur mesurée", done: false },
        { text: "Périmètre de sécurité balisé", done: false },
      ],
    },
    rh: [
      { role: "Chef d'équipe", quantity: 1, duration_estimate: "1 jour", notes: "" },
      { role: "Manutentionnaire", quantity: 2, duration_estimate: "1 jour", notes: "Intérieur + extérieur" },
      { role: "Monteur", quantity: 1, duration_estimate: "1 jour", notes: "Opérateur monte-meubles" },
    ],
    vehicules: [
      { type: "camion", label: "Camion déménagement", capacity: 40, notes: "" },
      { type: "nacelle", label: "Monte-meubles", capacity: null, notes: "Hauteur selon étage" },
    ],
  },
  {
    id: "curage",
    label: "Curage / Débarras",
    description: "Vidage et nettoyage complet d'un local ou bâtiment",
    operationType: "C",
    methodologie: {
      content: `1. Visite du site et évaluation du volume à évacuer
2. Tri des matériaux (recyclable, déchets, objets à conserver)
3. Mise en place des bennes
4. Évacuation pièce par pièce
5. Nettoyage grossier des locaux
6. Évacuation des bennes vers les centres agréés
7. Remise des bordereaux de suivi des déchets`,
      checklist: [
        { text: "Bennes commandées", done: false },
        { text: "Tri sélectif organisé", done: false },
        { text: "EPI fournis (gants, masques)", done: false },
        { text: "Bordereaux de déchets préparés", done: false },
        { text: "Accès camion benne vérifié", done: false },
      ],
    },
    rh: [
      { role: "Chef d'équipe", quantity: 1, duration_estimate: "2 jours", notes: "" },
      { role: "Manutentionnaire", quantity: 4, duration_estimate: "2 jours", notes: "" },
      { role: "Chauffeur", quantity: 1, duration_estimate: "2 jours", notes: "Navettes bennes" },
    ],
    vehicules: [
      { type: "camion", label: "Camion benne", capacity: null, notes: "Évacuation déchets" },
      { type: "utilitaire", label: "Utilitaire", capacity: null, notes: "Matériel d'équipe" },
    ],
  },
  {
    id: "transfert_bureau",
    label: "Transfert de bureaux",
    description: "Déménagement d'entreprise avec mobilier de bureau et matériel IT",
    operationType: "TB",
    methodologie: {
      content: `1. Audit des postes de travail et du mobilier
2. Étiquetage par zone / département
3. Préparation des rolls et caisses IT
4. Déconnexion et emballage du matériel informatique
5. Démontage du mobilier de bureau
6. Chargement par zone
7. Transport et déchargement
8. Remontage du mobilier
9. Reconnexion IT (en coordination avec le service informatique)
10. Vérification poste par poste`,
      checklist: [
        { text: "Plan d'étiquetage validé", done: false },
        { text: "Caisses IT préparées", done: false },
        { text: "Coordination IT planifiée", done: false },
        { text: "Clés et badges récupérés", done: false },
        { text: "Ascenseur réservé", done: false },
        { text: "Protection sols et murs", done: false },
      ],
    },
    rh: [
      { role: "Chef d'équipe", quantity: 1, duration_estimate: "2 jours", notes: "Coordinateur" },
      { role: "Manutentionnaire", quantity: 4, duration_estimate: "2 jours", notes: "" },
      { role: "Monteur", quantity: 2, duration_estimate: "2 jours", notes: "Démontage/remontage mobilier" },
      { role: "Chauffeur", quantity: 2, duration_estimate: "2 jours", notes: "Navettes" },
    ],
    vehicules: [
      { type: "camion", label: "Camion 50m³", capacity: 50, notes: "" },
      { type: "utilitaire", label: "Utilitaire matériel IT", capacity: null, notes: "Caisses informatiques" },
    ],
  },
];
