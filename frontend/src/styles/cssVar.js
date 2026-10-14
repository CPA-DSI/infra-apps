// Lecture des tokens de styles/theme.css depuis le JS.
// Certaines bibliothèques (ApexCharts, SweetAlert2, react-select) attendent des
// couleurs résolues : on lit la valeur calculée sur :root au moment de l'appel.
// Repli (tests jsdom, rendu hors navigateur) : la valeur déclarée dans
// theme.css, lue en texte brut — theme.css reste l'unique source.
import themeSource from './theme.css?raw';

const declared = Object.fromEntries(
  [...themeSource.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
);

/** Valeur déclarée dans theme.css, var() résolues. */
const resolveDeclared = (name, depth = 0) => {
  const value = declared[name];
  if (!value || depth > 10) return '';
  return value.replace(/var\((--[\w-]+)\)/g, (_, ref) => resolveDeclared(ref, depth + 1));
};

/** Valeur résolue d'une variable CSS de :root (repli : theme.css). */
export const cssVar = (name, fallback = resolveDeclared(name)) => {
  if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};
