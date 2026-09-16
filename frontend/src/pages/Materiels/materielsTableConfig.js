// Configuration statique du DataTable (react-data-table-component) de la page Matériels.

export const modernStyles = {
    table: {
        style: {
            backgroundColor: 'transparent',
            borderRadius: '16px',
        },
    },
    headRow: {
        // Le tableau défile avec la page (pas de scroll interne : pas de
        // fixedHeader sur ce DataTable), donc "top: 0" collerait l'en-tête
        // sous la navbar fixe, qui le recouvrirait au scroll. On colle
        // plutôt juste sous la navbar via --navbar-height (mesurée dans
        // FixedNavbarWithLogo.js).
        style: {
            backgroundColor: '#f9fafb', border: 'none', minHeight: '52px', borderRadius: '12px 12px 0 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', position: 'sticky', top: 'var(--navbar-height, 90px)', zIndex: 10
        },
    },
    headCells: {
        style: {
            fontSize: '0.75rem', fontWeight: '600', color: '#374151', letterSpacing: '0.02em', textTransform: 'capitalize', paddingLeft: '16px', paddingRight: '16px', paddingTop: '14px', paddingBottom: '14px', verticalAlign: 'middle', textAlign: 'left', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none'
        },
    },
    rows: {
        style: {
            fontSize: '0.85rem', fontWeight: '500', color: '#212529', minHeight: '52px', backgroundColor: '#ffffff', transition: 'all 0.2s ease', borderBottom: '1px solid #f3f4f6'
        },
        highlightOnHoverStyle: {
            backgroundColor: '#f5f3ff', color: '#5b21b6', cursor: 'pointer', transitionDuration: '0.2s'
        },
    },
    pagination: {
        style: {
            border: 'none', fontSize: '12px', color: '#6c757d', paddingTop: '16px', paddingBottom: '16px'
        },
    },
};

export const paginationOptions = {
    rowsPerPageText: 'Lignes par page :', rangeSeparatorText: 'sur', selectAllRowsItem: true, selectAllRowsItemText: 'Tout'
};

export const statusConfig = {
    'Très Bon':   { emoji: '✅', color: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
    'Bon':        { emoji: '👍', color: '#1e40af', bg: '#dbeafe', border: '#bfdbfe' },
    'Moyen':      { emoji: '⚠️', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
    'Mauvais':    { emoji: '❗', color: '#9f1239', bg: '#fee2e2', border: '#fecaca' },
    'Disponible': { emoji: '📦', color: '#4d7c0f', bg: '#ecfdf5', border: '#a7f3d0' },
    'HS':         { emoji: '❌', color: '#991b1b', bg: '#fee2e2', border: '#fecaca' }
};
