// Configuration statique du DataTable (react-data-table-component) de la page Matériels.

import { tableStyles, stickyHeadRow } from '../../styles/dataTableTheme';

// Le tableau défile avec la page (pas de fixedHeader) : l'en-tête colle
// juste sous la navbar fixe (cf. stickyHeadRow et --navbar-height).
export const materielsTableStyles = tableStyles(stickyHeadRow);

// États physiques d'un PC (materiels.etat_pc), dans l'ordre d'affichage.
// Même liste que ETATS_PHYSIQUES côté backend (affectationService).
export const ETATS_PHYSIQUES = ['Très Bon', 'Bon', 'Moyen', 'Mauvais', 'HS'];

// Badges d'état physique (aussi utilisés par Home/UserMaterielCard) : la
// couleur est portée par la tonalité (styles/tones.css).
export const statusConfig = {
    'Très Bon':   { emoji: '✅', tone: 'success' },
    'Bon':        { emoji: '👍', tone: 'info' },
    'Moyen':      { emoji: '⚠️', tone: 'warning' },
    'Mauvais':    { emoji: '❗', tone: 'rose' },
    'HS':         { emoji: '❌', tone: 'danger' },
};

// Options des formulaires (ajout / modification).
export const etatPhysiqueOptions = ETATS_PHYSIQUES.map(etat => ({
    value: etat,
    label: `${statusConfig[etat].emoji} ${etat}`,
}));

// Statut d'un poste, déduit de l'affectation (cf. getStatut dans Materiels.js).
export const statutConfig = {
    'Affecté':    { emoji: '👤' },
    'Stock':      { emoji: '📥' },
    'Sans poste': { emoji: '🚫' },
};
