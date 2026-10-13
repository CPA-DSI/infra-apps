// Configuration statique du DataTable (react-data-table-component) de la page Matériels.

import { tableStyles, stickyHeadRow } from '../../styles/dataTableTheme';

// Le tableau défile avec la page (pas de fixedHeader) : l'en-tête colle
// juste sous la navbar fixe (cf. stickyHeadRow et --navbar-height).
export const materielsTableStyles = tableStyles(stickyHeadRow);

// Couleurs des badges d'état (aussi utilisées par Home/UserMaterielCard).
export const statusConfig = {
    'Très Bon':   { emoji: '✅', color: '#065f46', bg: 'var(--color-success-soft)', border: '#a7f3d0' },
    'Bon':        { emoji: '👍', color: '#1e40af', bg: 'var(--color-info-soft)', border: '#bfdbfe' },
    'Moyen':      { emoji: '⚠️', color: '#92400e', bg: 'var(--color-warning-soft)', border: '#fde68a' },
    'Mauvais':    { emoji: '❗', color: '#9f1239', bg: 'var(--color-danger-soft)', border: '#fecaca' },
    'Disponible': { emoji: '📦', color: '#4d7c0f', bg: '#ecfdf5', border: '#a7f3d0' },
    'HS':         { emoji: '❌', color: '#991b1b', bg: 'var(--color-danger-soft)', border: '#fecaca' },
    // Posés par la mise en stock d'un PC (cf. affecterPC côté backend)
    'Stock':      { emoji: '📥', color: 'var(--color-text-body)', bg: 'var(--color-border)', border: 'var(--color-border-strong)' },
    'Sans poste': { emoji: '🚫', color: '#92400e', bg: 'var(--color-warning-soft)', border: '#fde68a' }
};
