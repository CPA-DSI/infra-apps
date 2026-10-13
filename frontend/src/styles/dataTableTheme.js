// Thème partagé des tableaux react-data-table-component.
// Les couleurs passent par les variables CSS de styles/theme.css
// (react-data-table-component injecte ces valeurs telles quelles en CSS).

const base = {
  table: {
    style: {
      backgroundColor: 'transparent',
      borderRadius: 'var(--radius-lg)',
    },
  },
  headRow: {
    style: {
      backgroundColor: 'var(--color-surface-alt)',
      border: 'none',
      minHeight: '52px',
      borderRadius: '12px 12px 0 0',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
    },
  },
  headCells: {
    style: {
      fontSize: '0.75rem',
      fontWeight: '600',
      color: 'var(--color-text-body)',
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      paddingLeft: '16px',
      paddingRight: '16px',
      paddingTop: '14px',
      paddingBottom: '14px',
      verticalAlign: 'middle',
      textAlign: 'left',
      backgroundColor: 'var(--color-surface-alt)',
      borderBottom: '2px solid var(--color-border)',
      whiteSpace: 'nowrap',
      userSelect: 'none',
    },
  },
  cells: {
    style: {
      paddingLeft: '16px',
      paddingRight: '16px',
    },
  },
  rows: {
    style: {
      fontSize: '0.85rem',
      fontWeight: '500',
      color: 'var(--color-text-main)',
      minHeight: '52px',
      backgroundColor: 'var(--color-bg)',
      transition: 'background-color 0.2s ease, color 0.2s ease',
      borderBottom: '1px solid var(--color-border-light)',
    },
    highlightOnHoverStyle: {
      backgroundColor: 'var(--color-primary-soft)',
      color: 'var(--color-primary-darker)',
      cursor: 'pointer',
      transitionDuration: '0.2s',
      outline: 'none',
    },
  },
  pagination: {
    style: {
      border: 'none',
      fontSize: '12px',
      color: 'var(--color-text-sub)',
      paddingTop: '16px',
      paddingBottom: '16px',
    },
  },
  noData: {
    style: {
      color: 'var(--color-text-sub)',
      padding: '24px',
    },
  },
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (target, source) => {
  const output = { ...target };
  Object.entries(source || {}).forEach(([key, value]) => {
    output[key] = isObject(value) && isObject(target[key]) ? deepMerge(target[key], value) : value;
  });
  return output;
};

/**
 * Retourne les customStyles du thème, éventuellement complétés par des
 * surcharges propres à une page (fusion profonde).
 *
 *   const styles = tableStyles({ rows: { style: { minHeight: '48px' } } });
 */
export const tableStyles = (overrides) => deepMerge(base, overrides);

/** En-tête collant sous la navbar fixe (tableaux sans fixedHeader). */
export const stickyHeadRow = {
  headRow: {
    style: {
      position: 'sticky',
      top: 'var(--navbar-height, 90px)',
      zIndex: 'var(--z-sticky)',
    },
  },
};

/** Thème par défaut, prêt à l'emploi. */
export const defaultTableStyles = tableStyles();

/** Options de pagination en français, communes à tous les tableaux. */
export const paginationOptions = {
  rowsPerPageText: 'Lignes par page :',
  rangeSeparatorText: 'sur',
  selectAllRowsItem: true,
  selectAllRowsItemText: 'Tout',
};
