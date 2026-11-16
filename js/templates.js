// Dispositions des pôles : chaque pôle affiche ses sections dans cet ordre.
// Types de section :
//   files      : dépôt de fichiers / liens / textes avec aperçu (option comments : commentaires)
//   quotes     : devis avec prix (option categories : ex. Bus, Activité) et pièce jointe
//   ideas      : idées en cartes (option fields : image, qty, price, ingredients)
//   notes      : bloc-notes
//   sales      : ventes (date, personnes mobilisées, recette)
//   partners   : partenaires et avantages
//   schedule   : déroulement minuté
//   apartments : appartements sur une carte + répartition des rôles
// Option lead_only : seul le responsable (ou bureau/admin) peut ajouter dans la section.

export const SECTION_TYPES = {
  files: 'Fichiers', quotes: 'Devis', ideas: 'Idées', notes: 'Bloc-notes',
  sales: 'Ventes', partners: 'Partenaires', schedule: 'Déroulement minuté', apartments: 'Appartements (carte)',
};

export const TEMPLATES = {
  goodies: {
    label: 'Goodies', gauge: true, layout: [
      { key: 'devis', title: 'Devis Festi Print', type: 'files', comments: true },
      { key: 'logos', title: 'Logos', type: 'files', comments: true },
      { key: 'idees', title: 'Idées de goodies', type: 'ideas', fields: ['image', 'qty', 'price'] },
    ],
  },
  sport: {
    label: 'Aprèm sport', gauge: true, layout: [
      { key: 'devis', title: 'Devis (bus + activité)', type: 'quotes', categories: ['Bus', 'Activité'] },
    ],
  },
  com: {
    label: 'Communication', gauge: true, layout: [
      { key: 'stories', title: 'Fonds des stories', type: 'files' },
      { key: 'videos', title: 'Stockage des vidéos', type: 'files' },
    ],
  },
  rap: {
    label: 'Rap', gauge: true, layout: [
      { key: 'prod', title: 'Prod', type: 'files', comments: true },
      { key: 'texte', title: 'Texte', type: 'files', comments: true },
      { key: 'final', title: 'Musique finale', type: 'files', comments: true },
    ],
  },
  kermesse: {
    label: 'Kermesse', gauge: true, layout: [
      { key: 'devis', title: 'Devis (activités)', type: 'quotes', categories: ['Activité'] },
      { key: 'idees', title: 'Idées de disposition et d\'activités', type: 'ideas', fields: ['image'] },
    ],
  },
  bds: {
    label: 'Soirée BDS', gauge: true, layout: [
      { key: 'devis', title: 'Devis (bus + activité)', type: 'quotes', categories: ['Bus', 'Activité'] },
      { key: 'idees', title: 'Idées d\'activités', type: 'ideas', fields: ['image'] },
    ],
  },
  film: {
    label: 'Film', gauge: true, layout: [
      { key: 'synopsis', title: 'Synopsis', type: 'notes' },
      { key: 'versions', title: 'Versions du film', type: 'files', comments: true },
    ],
  },
  cookies: {
    label: 'Vente cookies', gauge: false, layout: [
      { key: 'ventes', title: 'Ventes', type: 'sales', lead_only: true },
    ],
  },
  sos: {
    label: 'SOS', gauge: true, layout: [
      { key: 'plats', title: 'Idées de plats', type: 'ideas', fields: ['image', 'price', 'ingredients'] },
      { key: 'desserts', title: 'Idées de desserts', type: 'ideas', fields: ['image', 'price', 'ingredients'] },
      { key: 'orga', title: 'Organisation : appartements et rôles', type: 'apartments' },
    ],
  },
  partenariat: {
    label: 'Partenariat', gauge: false, layout: [
      { key: 'partenaires', title: 'Partenaires', type: 'partners', lead_only: true },
    ],
  },
  devoilement: {
    label: 'Dévoilement', gauge: true, layout: [
      { key: 'idees', title: 'Bloc-notes idées', type: 'notes' },
      { key: 'deroule', title: 'Déroulement minuté', type: 'schedule' },
      { key: 'fichiers', title: 'Fichiers', type: 'files', comments: true },
    ],
  },
  libre: {
    label: 'Libre (fichiers + bloc-notes)', gauge: true, layout: [
      { key: 'notes', title: 'Bloc-notes', type: 'notes' },
      { key: 'fichiers', title: 'Fichiers', type: 'files', comments: true },
    ],
  },
};

// Pôles de l'association, dans l'ordre d'affichage (utilisés par la démo et seed.sql).
export const ASSO_POLES = [
  { tpl: 'goodies', name: 'Goodies', color: '#7048e8', description: 'Devis Festi Print, logos et idées de goodies.' },
  { tpl: 'sport', name: 'Aprèm sport', color: '#e64980', description: 'Organisation de l\'après-midi sportive.' },
  { tpl: 'com', name: 'Communication', color: '#4f5bd5', description: 'Fonds des stories et vidéos.' },
  { tpl: 'rap', name: 'Rap', color: '#343a40', description: 'Prod, texte et musique finale.' },
  { tpl: 'kermesse', name: 'Kermesse', color: '#1c7ed6', description: 'Activités et disposition de la kermesse.' },
  { tpl: 'bds', name: 'Soirée BDS', color: '#c2255c', description: 'Soirée avec le BDS.' },
  { tpl: 'film', name: 'Film', color: '#f08c00', description: 'Synopsis et versions du film.' },
  { tpl: 'cookies', name: 'Vente cookies', color: '#a0522d', description: 'Suivi des ventes de cookies.' },
  { tpl: 'sos', name: 'SOS', color: '#2f9e44', description: 'Plats, desserts et organisation des appartements.' },
  { tpl: 'partenariat', name: 'Partenariat', color: '#0c8599', description: 'Partenaires et avantages obtenus.' },
  { tpl: 'devoilement', name: 'Dévoilement', color: '#e8590c', description: 'Idées, déroulé minuté et fichiers.' },
];
