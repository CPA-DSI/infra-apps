// Thème partagé des graphiques ApexCharts.
// ApexCharts a besoin de couleurs résolues (il calcule des dégradés et des
// opacités) : on lit donc les variables CSS de styles/theme.css au moment
// du rendu (cf. cssVar).

import { cssVar } from './cssVar';

export { cssVar };

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
    cssVar('--color-pink'), t.cyan, cssVar('--color-lime'), cssVar('--color-orange'), cssVar('--color-teal'),
    cssVar('--color-fuchsia'), cssVar('--color-rose'), cssVar('--color-sky'), cssVar('--color-warning-light'), cssVar('--color-secondary-light'),
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
