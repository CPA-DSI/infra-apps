// Configuration statique du DataTable (react-data-table-component) de la page Matériels.

import { tableStyles, stickyHeadRow } from '../../styles/dataTableTheme';

// Le tableau défile avec la page (pas de fixedHeader) : l'en-tête colle
// juste sous la navbar fixe (cf. stickyHeadRow et --navbar-height).
export const materielsTableStyles = tableStyles(stickyHeadRow);

// Badges d'état (aussi utilisés par Home/UserMaterielCard) : la couleur
// est portée par la tonalité (styles/tones.css).
export const statusConfig = {
    'Très Bon':   { emoji: '✅', tone: 'success' },
    'Bon':        { emoji: '👍', tone: 'info' },
    'Moyen':      { emoji: '⚠️', tone: 'warning' },
    'Mauvais':    { emoji: '❗', tone: 'rose' },
    'Disponible': { emoji: '📦', tone: 'lime' },
    'HS':         { emoji: '❌', tone: 'danger' },
    // Posés par la mise en stock d'un PC (cf. affecterPC côté backend)
    'Stock':      { emoji: '📥', tone: 'neutral' },
    'Sans poste': { emoji: '🚫', tone: 'warning' }
};
