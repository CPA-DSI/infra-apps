// Thème partagé des graphiques ApexCharts.
// ApexCharts a besoin de couleurs résolues (il calcule des dégradés et des
// opacités) : on lit donc les variables CSS de styles/theme.css au moment
// du rendu, avec des valeurs de repli identiques pour les tests (jsdom).

const FALLBACKS = {
  '--color-primary': '#6366f1',
  '--color-primary-dark': '#4f46e5',
  '--color-primary-lighter': '#a5b4fc',
  '--color-secondary': '#8b5cf6',
  '--color-success': '#10b981',
  '--color-warning': '#f59e0b',
  '--color-danger': '#ef4444',
  '--color-info': '#3b82f6',
  '--color-cyan': '#06b6d4',
  '--dash-bg': '#0f172a',
  '--dash-surface': '#1e293b',
  '--dash-border': '#334155',
  '--dash-text': '#f1f5f9',
  '--dash-text-sub': '#94a3b8',
};

/** Valeur résolue d'une variable CSS de :root (repli si indisponible). */
export const cssVar = (name, fallback = FALLBACKS[name] || '') => {
  if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

/** Couleurs des graphiques, lues dans les tokens du thème. */
export const getChartTheme = () => {
  const t = {
    primary: cssVar('--color-primary'),
    primaryDark: cssVar('--color-primary-dark'),
    primaryLight: cssVar('--color-primary-lighter'),
    secondary: cssVar('--color-secondary'),
    success: cssVar('--color-success'),
    warning: cssVar('--color-warning'),
    danger: cssVar('--color-danger'),
    info: cssVar('--color-info'),
    cyan: cssVar('--color-cyan'),
    // Surfaces sombres des dashboards
    bg: cssVar('--dash-bg'),
    surface: cssVar('--dash-surface'),
    grid: cssVar('--dash-border'),
    text: cssVar('--dash-text'),
    textSub: cssVar('--dash-text-sub'),
  };

  // Palette catégorielle : couleurs du thème d'abord, puis teintes complémentaires.
  t.palette = [
    t.primary, t.success, t.warning, t.danger, t.secondary,
    '#ec4899', t.cyan, '#84cc16', '#f97316', '#14b8a6',
    '#d946ef', '#f43f5e', '#0ea5e9', '#eab308', '#a855f7',
  ];
  return t;
};

/**
 * Options communes d'un graphique sur fond sombre (à fusionner avec les
 * options propres au graphique).
 */
export const darkChartBase = (t = getChartTheme()) => ({
  chart: {
    background: 'transparent',
    foreColor: t.textSub,
    fontFamily: 'inherit',
  },
  theme: { mode: 'dark' },
  grid: { borderColor: t.grid, strokeDashArray: 4 },
  legend: { labels: { colors: t.textSub } },
  tooltip: { theme: 'dark' },
});

/** Style d'un titre de graphique sur fond sombre. */
export const darkTitleStyle = (t = getChartTheme()) => ({
  color: t.text,
  fontSize: '16px',
  fontWeight: '600',
});
